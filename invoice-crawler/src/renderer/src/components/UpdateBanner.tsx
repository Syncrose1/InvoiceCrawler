import { AnimatePresence, motion } from 'framer-motion';
import { Download, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import { downloadUpdate, installUpdate, useUpdateStatus } from '../hooks/useUpdate';

export default function UpdateBanner() {
  const status = useUpdateStatus();
  const visible = status.phase !== 'idle' && status.phase !== 'checking';

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 25 }}
          className="fixed bottom-4 right-4 z-50 max-w-sm"
        >
          <div className="ice-card frost-overlay px-4 py-3 shadow-glow-md flex items-center gap-3">
            {status.phase === 'available' && (
              <>
                <Sparkles className="w-4 h-4 text-ice-accent shrink-0" />
                <div className="flex-1 text-sm">
                  <div className="font-medium">Update {status.version} available</div>
                  <div className="text-xs text-ice-text-dim">
                    Fancy a download? Takes a minute, no fuss.
                  </div>
                </div>
                <button
                  onClick={() => downloadUpdate()}
                  className="ice-button-primary text-xs px-3 py-1.5"
                >
                  <Download className="w-3 h-3 inline mr-1" />
                  Download
                </button>
              </>
            )}
            {status.phase === 'downloading' && (
              <>
                <Download className="w-4 h-4 text-ice-accent animate-pulse shrink-0" />
                <div className="flex-1 text-sm">
                  <div className="font-medium">Fetching the update…</div>
                  <div className="mt-1 h-1 rounded-full bg-ice-bg overflow-hidden">
                    <motion.div
                      animate={{ width: `${status.percent}%` }}
                      transition={{ ease: 'linear', duration: 0.2 }}
                      className="h-full bg-gradient-to-r from-ice-accent-glow to-ice-accent"
                    />
                  </div>
                </div>
                <div className="text-xs text-ice-text-dim tabular-nums w-10 text-right">
                  {status.percent}%
                </div>
              </>
            )}
            {status.phase === 'ready' && (
              <>
                <RefreshCw className="w-4 h-4 text-ice-success shrink-0" />
                <div className="flex-1 text-sm">
                  <div className="font-medium">Version {status.version} is ready.</div>
                  <div className="text-xs text-ice-text-dim">
                    A quick restart will pop you on it.
                  </div>
                </div>
                <button
                  onClick={() => installUpdate()}
                  className="ice-button-primary text-xs px-3 py-1.5"
                >
                  Restart
                </button>
              </>
            )}
            {status.phase === 'error' && (
              <>
                <AlertCircle className="w-4 h-4 text-ice-danger shrink-0" />
                <div className="flex-1 text-sm">
                  <div className="font-medium">Update check failed</div>
                  <div className="text-xs text-ice-text-dim truncate" title={status.message}>
                    {status.message}
                  </div>
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
