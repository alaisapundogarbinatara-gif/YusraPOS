import React, { useState, useEffect, useRef } from 'react';
import { X, Zap } from 'lucide-react';
import { BarcodeScanner, SupportedFormat } from '@capacitor-community/barcode-scanner';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { toast } from 'sonner';

interface QRScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

export default function QRScanner({ onScan, onClose }: QRScannerProps) {
  const [error, setError] = useState<string | null>(null);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const isNative = Capacitor.isNativePlatform();
  
  // Scan control refs
  const lastScanTime = useRef<number>(0);
  const lastCode = useRef<string>("");
  const scanActive = useRef<boolean>(true);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const [cameras, setCameras] = useState<any[]>([]);
  const [currentCameraId, setCurrentCameraId] = useState<string | null>(null);

  useEffect(() => {
    // Expose scan result handler to window for native bridge
    (window as any).onScanResult = (code: string) => {
      handleScanResult(code);
    };

    if (isNative) {
      prepareScanner();
    } else {
      initWebScanner();
    }

    return () => {
      delete (window as any).onScanResult;
      scanActive.current = false;
      if (isNative) {
        stopNativeScan();
      } else {
        stopWebScanner();
      }
    };
  }, []);

  const initWebScanner = async () => {
    try {
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length > 0) {
        setCameras(devices);
        // Try to find back camera
        const backCamera = devices.find(d => d.label.toLowerCase().includes('back') || d.label.toLowerCase().includes('rear'));
        const targetId = backCamera ? backCamera.id : devices[0].id;
        setCurrentCameraId(targetId);
        startWebScanner(targetId);
      } else {
        setError('No cameras found on this device.');
      }
    } catch (err) {
      console.error('Get Cameras Error:', err);
      setError('Camera access denied or not available.');
    }
  };

  const switchCamera = async () => {
    if (cameras.length < 2) return;
    
    const currentIndex = cameras.findIndex(c => c.id === currentCameraId);
    const nextIndex = (currentIndex + 1) % cameras.length;
    const nextId = cameras[nextIndex].id;
    
    await stopWebScanner();
    setCurrentCameraId(nextId);
    startWebScanner(nextId);
  };

  const handleScanResult = (code: string) => {
    if (!code) return;
    const currentTime = Date.now();
    // Prevent duplicate scans (1.5s delay for same code)
    if (code === lastCode.current && (currentTime - lastScanTime.current) < 1500) {
      return;
    }

    lastCode.current = code;
    lastScanTime.current = currentTime;

    // Feedback
    playBeep();
    if (isNative) {
      Haptics.impact({ style: ImpactStyle.Heavy });
    }
    
    // Send to POS
    onScan(code);
    toast.success(`Scanned: ${code}`, { duration: 1000 });
  };

  const startWebScanner = async (cameraId: string) => {
    try {
      // Ensure the element exists before starting
      const element = document.getElementById("web-reader");
      if (!element) {
        setTimeout(() => startWebScanner(cameraId), 100);
        return;
      }

      const html5QrCode = new Html5Qrcode("web-reader");
      html5QrCodeRef.current = html5QrCode;
      
      const config = { 
        fps: 15, 
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const qrboxSize = Math.floor(minEdge * 0.7);
          return { width: qrboxSize, height: qrboxSize };
        },
        aspectRatio: 1.0
      };

      await html5QrCode.start(
        cameraId, 
        config, 
        (decodedText) => {
          handleScanResult(decodedText);
        },
        () => {} // Ignore errors
      );
      
      setIsScanning(true);
      setError(null);
    } catch (err) {
      console.error('Web Scanner Start Error:', err);
      setError('Failed to start camera. Please check permissions.');
    }
  };

  const stopWebScanner = async () => {
    if (html5QrCodeRef.current && html5QrCodeRef.current.isScanning) {
      try {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current.clear();
      } catch (err) {
        console.error('Stop Web Scanner Error:', err);
      }
    }
  };

  const prepareScanner = async () => {
    try {
      // If our custom native scanner is available, use it
      if ((window as any).AndroidScanner) {
        (window as any).AndroidScanner.openNativeScanner();
        setIsScanning(true);
      } else {
        await BarcodeScanner.prepare();
        startContinuousScan();
      }
    } catch (err) {
      console.error('Prepare Scanner Error:', err);
      startContinuousScan();
    }
  };

  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.5, audioCtx.currentTime + 0.01);
      gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.2);

      oscillator.start(audioCtx.currentTime);
      oscillator.stop(audioCtx.currentTime + 0.2);
    } catch (e) {
      console.warn('Beep failed:', e);
    }
  };

  const startContinuousScan = async () => {
    if (!scanActive.current) return;
    
    try {
      const status = await BarcodeScanner.checkPermission({ force: true });
      
      if (status.granted) {
        await BarcodeScanner.hideBackground();
        document.body.classList.add('scanner-active');
        document.documentElement.classList.add('scanner-active');
        setIsScanning(true);
        
        // Continuous scan loop
        while (scanActive.current) {
          const result = await BarcodeScanner.startScan({
            targetedFormats: [SupportedFormat.QR_CODE, SupportedFormat.EAN_13, SupportedFormat.EAN_8, SupportedFormat.CODE_128]
          });
          
          if (result.hasContent && scanActive.current) {
            handleScanResult(result.content);
          }
        }
      } else {
        setError('Camera permission denied');
      }
    } catch (err) {
      console.error('Native Scan Error:', err);
      setIsScanning(false);
      document.body.classList.remove('scanner-active');
      document.documentElement.classList.remove('scanner-active');
    }
  };

  const toggleTorch = async () => {
    try {
      if (isTorchOn) {
        await BarcodeScanner.disableTorch();
      } else {
        await BarcodeScanner.enableTorch();
      }
      setIsTorchOn(!isTorchOn);
    } catch (err) {
      console.error('Torch Error:', err);
    }
  };

  const stopNativeScan = async () => {
    scanActive.current = false;
    try {
      document.body.classList.remove('scanner-active');
      document.documentElement.classList.remove('scanner-active');
      await BarcodeScanner.showBackground();
      await BarcodeScanner.stopScan();
      await BarcodeScanner.disableTorch();
    } catch (err) {
      console.error('Stop Native Scan Error:', err);
    }
  };

  const handleClose = () => {
    if (isNative) {
      stopNativeScan();
    } else {
      stopWebScanner();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col">
      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-black/60 to-transparent z-20 flex items-center justify-between px-6">
        <button 
          onClick={handleClose} 
          className="p-2 text-white hover:bg-white/10 rounded-full transition-all"
        >
          <X size={28} />
        </button>
        
        <div className="flex items-center gap-2">
          {!isNative && cameras.length > 1 && (
            <button 
              onClick={switchCamera}
              className="p-3 bg-white/10 text-white rounded-full transition-all hover:bg-white/20"
              title="Switch Camera"
            >
              <Zap size={24} />
            </button>
          )}
          {isNative && (
            <button 
              onClick={toggleTorch}
              className={`p-3 rounded-full transition-all ${isTorchOn ? 'bg-yellow-400 text-black' : 'bg-white/10 text-white'}`}
            >
              <Zap size={24} fill={isTorchOn ? 'currentColor' : 'none'} />
            </button>
          )}
        </div>
      </div>

      {/* Camera View Area */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden">
        {isNative && !error ? (
          <div className="relative w-72 h-72">
            {/* Corner Markers */}
            <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-2xl"></div>
            <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-2xl"></div>
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-2xl"></div>
            <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-2xl"></div>
            
            {/* Scanning Animation Line */}
            <div className="absolute left-4 right-4 h-0.5 bg-primary/50 shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)] animate-scan-line"></div>
            
            {/* Darkened Overlay around the frame */}
            <div className="absolute -inset-[2000px] border-[2000px] border-black/40 pointer-events-none"></div>
          </div>
        ) : (
          <div className="w-full h-full bg-black flex items-center justify-center relative">
            <div id="web-reader" className="w-full h-full"></div>
            
            {error && (
              <div className="absolute inset-0 z-30 bg-black/80 flex items-center justify-center p-6 text-center">
                <div className="max-w-xs">
                  <p className="text-red-400 mb-6 font-medium">{error}</p>
                  <div className="space-y-3">
                    <button onClick={() => { setError(null); initWebScanner(); }} className="w-full py-3 bg-primary text-white rounded-xl font-bold">Retry Camera</button>
                    <button onClick={handleClose} className="w-full py-3 bg-white/10 text-white rounded-xl">Cancel</button>
                  </div>
                </div>
              </div>
            )}
            
            {!isScanning && !error && (
              <div className="absolute inset-0 z-20 bg-black flex items-center justify-center">
                <div className="text-white text-center">
                  <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-sm font-medium opacity-70">Initializing scanner...</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Bar with Manual Entry */}
      <div className="bg-zinc-900/90 backdrop-blur-xl border-t border-white/10 p-6 pb-safe z-20">
        <div className="max-w-md mx-auto space-y-4">
          <div className="flex flex-col items-center gap-1 mb-2">
            <p className="text-white font-bold text-sm tracking-widest uppercase">
              {isNative ? 'Continuous Hardware Scan' : 'Web Scanner Active'}
            </p>
            <p className="text-white/40 text-[10px] text-center uppercase tracking-wider">
              {isScanning ? 'Align barcode within the frame' : 'Preparing camera...'}
            </p>
          </div>

          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder="Enter barcode manually..." 
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-primary transition-colors text-sm"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && manualCode) {
                  handleScanResult(manualCode);
                  setManualCode('');
                }
              }}
            />
            <button 
              onClick={() => {
                if (manualCode) {
                  handleScanResult(manualCode);
                  setManualCode('');
                }
              }}
              className="px-6 bg-primary text-white font-bold rounded-xl active:scale-95 transition-all text-sm"
            >
              Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

