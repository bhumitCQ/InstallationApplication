import { useEffect, useMemo, useState } from 'react';
import './App.css';
import { Spinner } from './components/ui/shadcn-io/spinner';
import { AlertCircle } from 'lucide-react';
import { Button } from './components/ui/button';
import { supportedPlatforms } from './constants';
import { ProcessPage } from './pages/process';
import { useQuery } from '@tanstack/react-query';

function App() {
  const platformQuery = useQuery({
    queryKey: ['platform'],
    queryFn: async () => {
      const detectedPlatform = (await window.ipcRenderer?.invoke('os')) as Platform;
      if (!detectedPlatform) {
        return "win32";
      }
      console.log({ detectedPlatform });
      return detectedPlatform;
    }
  });

  if (platformQuery.isLoading) {
    return (
      <div className="h-full w-full flex items-center justify-center">
        <div className="h-12 w-12 flex items-center justify-center m-auto ">
          <Spinner size="lg" className="animate-spin" />
        </div>
      </div>
    );
  };

  if (platformQuery.error || !platformQuery.data || !supportedPlatforms.includes(platformQuery.data)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="text-center">
        <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-destructive" />
        </div>
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Platform Not Supported
        </h2>
        <p className="text-muted-foreground mb-4">
          We appologize but your platform is not supported.
        </p>
        <Button onClick={() => window.close()}>
          Exit
        </Button>
      </div>
    </div>
    );
  };

  return (
    <ProcessPage />
  );
}

export default App