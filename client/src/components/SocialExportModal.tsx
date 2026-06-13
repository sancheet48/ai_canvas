import React, { useState, useEffect } from 'react';
import { 
  X, 
  Download, 
  FileImage, 
  FileCode, 
  FileText, 
  FileJson, 
  Share2, 
  Linkedin, 
  Twitter, 
  Check, 
  Copy, 
  Loader2,
  Plus,
  Trash2,
  AlertCircle
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import { useCanvasStore } from '../store/useCanvasStore';
import { useAuthStore } from '../store/useAuthStore';

interface SocialExportModalProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  onClose: () => void;
}

export const SocialExportModal: React.FC<SocialExportModalProps> = ({ canvasRef, onClose }) => {
  const { elements } = useCanvasStore();
  const { accessToken } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'export' | 'social'>('export');
  
  // Social linking status
  const [connections, setConnections] = useState<{ provider: string; connected: boolean }[]>([]);
  const [loadingStatus, setLoadingStatus] = useState(false);

  // LinkedIn Compose State
  const [linkedinCaption, setLinkedinCaption] = useState('Drafting my new diagram whiteboard project. Built with Collaborative Board AI!');
  const [publishingLinkedin, setPublishingLinkedin] = useState(false);

  // Twitter/X Thread Compose State
  const [tweets, setTweets] = useState<string[]>([
    'Check out my new whiteboard workflow drawing! 🚀👇 1/2',
    'Created this layout using automated vector graphics and AI helpers. 2/2'
  ]);
  const [publishingTwitter, setPublishingTwitter] = useState(false);

  // Copy success feedback states
  const [copiedText, setCopiedText] = useState(false);
  const [successPostUrl, setSuccessPostUrl] = useState('');

  // 1. FETCH SOCIAL STATUS
  useEffect(() => {
    if (activeTab === 'social') {
      fetchConnections();
    }
  }, [activeTab]);

  const fetchConnections = async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch('/api/social/status', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const data = await res.json();
      if (res.ok) setConnections(data);
    } catch (err) {
      console.error('Fetch connection links failed:', err);
    } finally {
      setLoadingStatus(false);
    }
  };

  const isProviderConnected = (p: string) => {
    return connections.find(c => c.provider === p)?.connected || false;
  };

  // 2. SOCIAL CONNECTION REDIRECTS
  const handleConnectProvider = (provider: string) => {
    // Redirect browser directly to the oauth callback pipeline (saving state JWT)
    window.location.href = `/api/social/oauth/${provider}?token=${accessToken}`;
  };

  const handleDisconnectProvider = async (provider: string) => {
    try {
      await fetch(`/api/social/${provider}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      fetchConnections();
    } catch (err) {
      console.error(err);
    }
  };

  // 3. EXPORTS FUNCTIONS
  const handleExportPng = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = 'whiteboard-capture.png';
    link.href = dataUrl;
    link.click();
  };

  const handleExportJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(elements, null, 2));
    const link = document.createElement('a');
    link.download = 'whiteboard-backup.json';
    link.href = dataStr;
    link.click();
  };

  const handleExportPdf = () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const imgData = canvas.toDataURL('image/png');
    
    // Landscape PDF mapping
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'px',
      format: [canvas.width, canvas.height]
    });
    
    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
    pdf.save('whiteboard-drawing.pdf');
  };

  const handleExportSvg = () => {
    // Generate standard XML SVG string matching active vector coordinates
    let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1920 1080" width="1920" height="1080" style="background-color: #0b0f19;">\n`;
    
    elements.forEach(el => {
      const opacity = el.opacity ?? 1;
      const stroke = el.strokeColor || '#8b5cf6';
      const fill = el.fillColor === 'transparent' ? 'none' : el.fillColor || 'none';
      const width = el.strokeWidth || 2;

      if (el.type === 'rectangle') {
        svgContent += `  <rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" opacity="${opacity}" transform="rotate(${el.angle * 180 / Math.PI} ${el.x + el.width/2} ${el.y + el.height/2})" />\n`;
      } else if (el.type === 'ellipse') {
        svgContent += `  <ellipse cx="${el.x + el.width/2}" cy="${el.y + el.height/2}" rx="${el.width/2}" ry="${el.height/2}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" opacity="${opacity}" transform="rotate(${el.angle * 180 / Math.PI} ${el.x + el.width/2} ${el.y + el.height/2})" />\n`;
      } else if (el.type === 'text' && el.text) {
        svgContent += `  <text x="${el.x}" y="${el.y + 15}" fill="${stroke}" font-family="sans-serif" font-size="20" font-weight="bold" opacity="${opacity}">${el.text}</text>\n`;
      }
    });

    svgContent += `</svg>`;

    const dataStr = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgContent);
    const link = document.createElement('a');
    link.download = 'whiteboard-canvas.svg';
    link.href = dataStr;
    link.click();
  };

  // 4. PUBLISHING CALLS
  const handlePublishLinkedin = async () => {
    if (!linkedinCaption.trim() || publishingLinkedin) return;
    setPublishingLinkedin(true);
    setSuccessPostUrl('');

    try {
      const res = await fetch('/api/social/linkedin/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ caption: linkedinCaption })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'LinkedIn post fail');

      setSuccessPostUrl(data.url);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 3000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setPublishingLinkedin(false);
    }
  };

  const handlePublishTwitter = async () => {
    if (tweets.some(t => !t.trim()) || publishingTwitter) return;
    setPublishingTwitter(true);
    setSuccessPostUrl('');

    try {
      const res = await fetch('/api/social/twitter/publish', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({ tweets })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Twitter thread fail');

      setSuccessPostUrl(data.urls[0]);
      setCopiedText(true);
      setTimeout(() => setCopiedText(false), 3000);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setPublishingTwitter(false);
    }
  };

  // Twitter thread helper editing methods
  const handleAddTweet = () => {
    const idx = tweets.length + 1;
    setTweets([...tweets, `Another step detailing the whiteboard concept... ${idx}/${idx}`]);
  };

  const handleRemoveTweet = (idx: number) => {
    if (tweets.length <= 1) return;
    setTweets(tweets.filter((_, i) => i !== idx));
  };

  const handleTweetChange = (idx: number, val: string) => {
    setTweets(tweets.map((t, i) => (i === idx ? val : t)));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-dark-950/60 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog Frame */}
      <div className="relative w-full max-w-lg glass-panel rounded-3xl p-6 shadow-2xl z-10 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-dark-800 pb-4 mb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Share2 className="w-5 h-5 text-brand-500" /> Export & Publish
            </h2>
            <p className="text-xs text-dark-200">Save your canvas locally or post directly to social networks</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl text-dark-200 hover:bg-dark-800 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2 p-1 bg-dark-900 border border-white/5 rounded-2xl mb-5">
          <button
            onClick={() => setActiveTab('export')}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
              activeTab === 'export'
                ? 'bg-brand-600 text-white shadow-md'
                : 'text-dark-200 hover:text-white'
            }`}
          >
            Local Download
          </button>
          <button
            onClick={() => setActiveTab('social')}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${
              activeTab === 'social'
                ? 'bg-brand-600 text-white shadow-md'
                : 'text-dark-200 hover:text-white'
            }`}
          >
            Social Publishing
          </button>
        </div>

        {/* TAB 1: EXPORT DOWNLOAD CARD */}
        {activeTab === 'export' && (
          <div className="grid grid-cols-2 gap-4 py-2 animate-in fade-in duration-200">
            {/* PNG */}
            <button
              onClick={handleExportPng}
              className="flex flex-col items-center gap-3 p-5 rounded-2xl bg-dark-900 border border-white/5 text-dark-200 hover:border-brand-500/30 hover:text-white hover-scale transition-all"
            >
              <div className="p-3 rounded-2xl bg-brand-500/10 text-brand-500">
                <FileImage className="w-8 h-8" />
              </div>
              <div className="text-center">
                <h4 className="text-xs font-bold">Export PNG Image</h4>
                <p className="text-[10px] text-dark-200 mt-1">High-quality canvas capture</p>
              </div>
            </button>

            {/* SVG */}
            <button
              onClick={handleExportSvg}
              className="flex flex-col items-center gap-3 p-5 rounded-2xl bg-dark-900 border border-white/5 text-dark-200 hover:border-brand-500/30 hover:text-white hover-scale transition-all"
            >
              <div className="p-3 rounded-2xl bg-brand-500/10 text-brand-500">
                <FileCode className="w-8 h-8" />
              </div>
              <div className="text-center">
                <h4 className="text-xs font-bold">Export SVG Vectors</h4>
                <p className="text-[10px] text-dark-200 mt-1">Fully scalable XML layout</p>
              </div>
            </button>

            {/* PDF */}
            <button
              onClick={handleExportPdf}
              className="flex flex-col items-center gap-3 p-5 rounded-2xl bg-dark-900 border border-white/5 text-dark-200 hover:border-brand-500/30 hover:text-white hover-scale transition-all"
            >
              <div className="p-3 rounded-2xl bg-brand-500/10 text-brand-500">
                <FileText className="w-8 h-8" />
              </div>
              <div className="text-center">
                <h4 className="text-xs font-bold">Export PDF Document</h4>
                <p className="text-[10px] text-dark-200 mt-1">Fit drawing to single sheet</p>
              </div>
            </button>

            {/* JSON */}
            <button
              onClick={handleExportJson}
              className="flex flex-col items-center gap-3 p-5 rounded-2xl bg-dark-900 border border-white/5 text-dark-200 hover:border-brand-500/30 hover:text-white hover-scale transition-all"
            >
              <div className="p-3 rounded-2xl bg-brand-500/10 text-brand-500">
                <FileJson className="w-8 h-8" />
              </div>
              <div className="text-center">
                <h4 className="text-xs font-bold">Export JSON Backup</h4>
                <p className="text-[10px] text-dark-200 mt-1">Full board state restore file</p>
              </div>
            </button>
          </div>
        )}

        {/* TAB 2: SOCIAL COMPOSERS */}
        {activeTab === 'social' && (
          <div className="flex flex-col gap-5 max-h-[440px] overflow-y-auto pr-1 animate-in fade-in duration-200">
            {loadingStatus ? (
              <div className="flex items-center justify-center p-6 text-dark-200 text-xs">
                <Loader2 className="w-5 h-5 animate-spin text-brand-500 mr-2" /> Loading connection records...
              </div>
            ) : (
              <>
                {/* 1. LINKEDIN SUBSECTION */}
                <div className="bg-dark-900/40 border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b border-dark-800 pb-2">
                    <div className="flex items-center gap-2 text-white font-semibold text-xs">
                      <Linkedin className="w-4 h-4 text-blue-500 fill-blue-500" /> LinkedIn Share
                    </div>
                    {isProviderConnected('linkedin') ? (
                      <button
                        onClick={() => handleDisconnectProvider('linkedin')}
                        className="text-[10px] text-red-500 font-bold hover:underline"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={() => handleConnectProvider('linkedin')}
                        className="text-[10px] text-brand-500 font-bold hover:underline"
                      >
                        Link Account
                      </button>
                    )}
                  </div>

                  {isProviderConnected('linkedin') ? (
                    <div className="flex flex-col gap-2.5">
                      <textarea
                        value={linkedinCaption}
                        onChange={(e) => setLinkedinCaption(e.target.value.substring(0, 3000))}
                        className="w-full h-20 bg-dark-900 border border-white/5 rounded-xl p-2.5 text-xs text-dark-100 placeholder-dark-200 outline-none focus:border-brand-500/30 font-sans"
                        placeholder="LinkedIn Caption..."
                      />
                      <div className="flex items-center justify-between text-[10px] text-dark-200">
                        <span>Limit: {linkedinCaption.length}/3000 chars</span>
                        <button
                          onClick={handlePublishLinkedin}
                          disabled={publishingLinkedin || !linkedinCaption.trim()}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold transition-all disabled:opacity-50"
                        >
                          {publishingLinkedin ? <Loader2 className="w-3 h-3 animate-spin" /> : <Share2 className="w-3 h-3" />} Publish
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-dark-200">Connect your LinkedIn profile to publish drawings and text summaries directly.</p>
                  )}
                </div>

                {/* 2. TWITTER SUBSECTION */}
                <div className="bg-dark-900/40 border border-white/5 rounded-2xl p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between border-b border-dark-800 pb-2">
                    <div className="flex items-center gap-2 text-white font-semibold text-xs">
                      <Twitter className="w-4 h-4 text-sky-400 fill-sky-400" /> Twitter/X Thread
                    </div>
                    {isProviderConnected('twitter') ? (
                      <button
                        onClick={() => handleDisconnectProvider('twitter')}
                        className="text-[10px] text-red-500 font-bold hover:underline"
                      >
                        Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={() => handleConnectProvider('twitter')}
                        className="text-[10px] text-brand-500 font-bold hover:underline"
                      >
                        Link Account
                      </button>
                    )}
                  </div>

                  {isProviderConnected('twitter') ? (
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
                        {tweets.map((t, index) => (
                          <div key={index} className="flex gap-2 items-start bg-dark-900 border border-white/5 p-2 rounded-xl">
                            <span className="text-[10px] font-bold text-brand-500 bg-brand-500/10 px-2 py-0.5 rounded-lg mt-1">{index + 1}</span>
                            <textarea
                              value={t}
                              onChange={(e) => handleTweetChange(index, e.target.value.substring(0, 280))}
                              className="flex-1 bg-transparent text-[11px] text-dark-100 outline-none resize-none h-10 placeholder-dark-200"
                              placeholder={`Tweet content...`}
                            />
                            <button
                              onClick={() => handleRemoveTweet(index)}
                              className="p-1 rounded-lg text-red-500 hover:bg-dark-800"
                              title="Delete Tweet"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>

                      <div className="flex items-center justify-between">
                        <button
                          onClick={handleAddTweet}
                          className="flex items-center gap-1 text-[10px] font-bold text-brand-500 hover:text-white"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Tweet
                        </button>
                        <button
                          onClick={handlePublishTwitter}
                          disabled={publishingTwitter || tweets.some(t => !t.trim())}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold transition-all disabled:opacity-50 text-[10px]"
                        >
                          {publishingTwitter ? <Loader2 className="w-3 h-3 animate-spin" /> : <Share2 className="w-3 h-3" />} Post Thread
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[10px] text-dark-200">Connect your Twitter/X account to post multi-tweet threads detailing board workflows.</p>
                  )}
                </div>

                {/* 3. SUCCESS COMPOSER BANNER */}
                {successPostUrl && (
                  <div className="p-3.5 bg-brand-600/15 border border-brand-500/20 rounded-2xl flex items-center gap-3 animate-in slide-in-from-bottom-2 duration-200">
                    <Check className="w-5 h-5 text-brand-500" />
                    <div className="flex-1">
                      <h4 className="text-xs font-bold text-white">Post Shared!</h4>
                      <p className="text-[10px] text-dark-200">Successfully published to social channel.</p>
                    </div>
                    <a
                      href={successPostUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1 bg-brand-600 text-white text-[10px] font-bold rounded-lg hover:bg-brand-700 transition-colors"
                    >
                      View Live
                    </a>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
