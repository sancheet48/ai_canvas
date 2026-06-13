import express, { Router, Request, Response } from 'express';
import { verifyJWT, AuthRequest } from '../middleware/auth';
import { db } from '../db';
import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();

// Initialize Stripe if apiKey exists
const stripeApiKey = process.env.STRIPE_SECRET_KEY || '';
const stripe = stripeApiKey ? new Stripe(stripeApiKey, { apiVersion: '2023-10-16' as any }) : null;

// Helper to update subscription in DB
async function updateSubscription(
  userId: number,
  customerId: string | null,
  subscriptionId: string | null,
  plan: 'free' | 'pro' | 'team',
  status: string,
  periodEnd: Date | null
) {
  await db.query(
    `INSERT INTO subscriptions (user_id, stripe_customer_id, stripe_subscription_id, plan, status, current_period_end)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (user_id) DO UPDATE
     SET stripe_customer_id = EXCLUDED.stripe_customer_id,
         stripe_subscription_id = EXCLUDED.stripe_subscription_id,
         plan = EXCLUDED.plan,
         status = EXCLUDED.status,
         current_period_end = EXCLUDED.current_period_end`,
    [userId, customerId, subscriptionId, plan, status, periodEnd]
  );
}

// 1. GET CURRENT SUBSCRIPTION DETAILS
router.get('/current', verifyJWT, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  try {
    const subRes = await db.query(
      'SELECT * FROM subscriptions WHERE user_id = $1',
      [userId]
    );
    if (subRes.rowCount === 0) {
      return res.status(200).json({ plan: 'free', status: 'active', current_period_end: null });
    }
    return res.status(200).json(subRes.rows[0]);
  } catch (err) {
    console.error('Fetch billing info failed:', err);
    return res.status(500).json({ error: 'Failed to fetch subscription data' });
  }
});

// 2. CREATE CHECKOUT SESSION (Stripe Checkout)
router.post('/checkout', verifyJWT, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const email = req.user!.email;
  const { plan } = req.body; // 'pro' or 'team'

  if (!['pro', 'team'].includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan choice' });
  }

  // Fallback to mock upgrade URL if Stripe is not configured
  if (!stripe) {
    return res.status(200).json({
      url: `/api/stripe/mock-callback?userId=${userId}&plan=${plan}`
    });
  }

  // Determine Price IDs from environment variables
  let priceId = '';
  if (plan === 'pro') {
    priceId = process.env.STRIPE_PRICE_PRO || 'price_mock_pro_123';
  } else if (plan === 'team') {
    priceId = process.env.STRIPE_PRICE_TEAM || 'price_mock_team_456';
  }

  const successUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/board?checkout_success=true`;
  const cancelUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/board?checkout_cancel=true`;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: email,
      metadata: { userId: userId.toString(), plan }
    });

    return res.status(200).json({ url: session.url });
  } catch (err: any) {
    console.error('Stripe checkout session creation failed:', err);
    // Silent failover to mock checkout link for dev ease
    return res.status(200).json({
      url: `/api/stripe/mock-callback?userId=${userId}&plan=${plan}`
    });
  }
});

// 3. MOCK BILLING CALLBACK (Simplifies local testing)
router.get('/mock-callback', async (req, res) => {
  const userIdStr = req.query.userId as string;
  const plan = req.query.plan as string; // 'pro' or 'team'

  const userId = parseInt(userIdStr);
  if (isNaN(userId) || !['pro', 'team', 'free'].includes(plan)) {
    return res.status(400).send('Invalid params');
  }

  try {
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
    await updateSubscription(
      userId,
      `mock_customer_id_${userId}`,
      `mock_subscription_id_${userId}`,
      plan as any,
      'active',
      periodEnd
    );
    return res.redirect(`${process.env.CLIENT_URL || 'http://localhost:5173'}/board?billing_success=true`);
  } catch (err: any) {
    return res.status(500).send(`Mock subscription failed: ${err.message}`);
  }
});

// 4. MOCK UPGRADE DIRECT CALL (From client UI setting)
router.post('/mock-upgrade', verifyJWT, async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { plan } = req.body; // 'free', 'pro', or 'team'

  if (!['free', 'pro', 'team'].includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan' });
  }

  try {
    const periodEnd = plan === 'free' ? null : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await updateSubscription(
      userId,
      plan === 'free' ? null : `mock_customer_id_${userId}`,
      plan === 'free' ? null : `mock_subscription_id_${userId}`,
      plan as any,
      'active',
      periodEnd
    );
    return res.status(200).json({ message: `Plan changed to ${plan} successfully` });
  } catch (err) {
    console.error('Mock upgrade error:', err);
    return res.status(500).json({ error: 'Failed to upgrade account' });
  }
});

// 5. STRIPE WEBHOOK HANDLER
router.post('/webhook', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

  if (!stripe || !sig || !webhookSecret) {
    return res.status(400).send('Webhook configuration missing');
  }

  let event: any;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    // Process subscription hooks
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any;
      const userId = parseInt(session.metadata?.userId || '');
      const plan = session.metadata?.plan as 'pro' | 'team';
      const customerId = session.customer as string;
      const subId = session.subscription as string;

      if (!isNaN(userId) && plan) {
        // Fetch subscription period end from Stripe
        const stripeSub = await stripe.subscriptions.retrieve(subId) as any;
        const periodEnd = new Date(stripeSub.current_period_end * 1000);
        
        await updateSubscription(userId, customerId, subId, plan, 'active', periodEnd);
        console.log(`[STRIPE WEBHOOK] Checkout completed. User ${userId} upgraded to ${plan}.`);
      }
    } else if (event.type === 'customer.subscription.updated') {
      const stripeSub = event.data.object as any;
      const subId = stripeSub.id;
      const status = stripeSub.status;
      const periodEnd = new Date(stripeSub.current_period_end * 1000);

      // Find user matching subscription
      const userSubRes = await db.query(
        'SELECT user_id, plan FROM subscriptions WHERE stripe_subscription_id = $1',
        [subId]
      );
      if (userSubRes.rowCount && userSubRes.rowCount > 0) {
        const userId = userSubRes.rows[0].user_id;
        const plan = userSubRes.rows[0].plan;
        
        await db.query(
          `UPDATE subscriptions 
           SET status = $1, current_period_end = $2 
           WHERE stripe_subscription_id = $3`,
          [status, periodEnd, subId]
        );
        console.log(`[STRIPE WEBHOOK] Subscription updated for user ${userId}. Status: ${status}`);
      }
    } else if (event.type === 'customer.subscription.deleted') {
      const stripeSub = event.data.object as any;
      const subId = stripeSub.id;

      const userSubRes = await db.query(
        'SELECT user_id FROM subscriptions WHERE stripe_subscription_id = $1',
        [subId]
      );
      if (userSubRes.rowCount && userSubRes.rowCount > 0) {
        const userId = userSubRes.rows[0].user_id;
        // Downgrade user to Free plan
        await updateSubscription(userId, null, null, 'free', 'canceled', null);
        console.log(`[STRIPE WEBHOOK] Subscription deleted. Downgraded user ${userId} to free.`);
      }
    }

    return res.status(200).json({ received: true });
  } catch (err: any) {
    console.error('Webhook event handling failed:', err);
    return res.status(500).send(`Internal error processing webhook: ${err.message}`);
  }
});

export default router;
