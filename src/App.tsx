import { useEffect, useMemo, useState } from 'react'
import UpdateElectron from '@/components/update'
import logoVite from './assets/logo-vite.svg'
import logoElectron from './assets/logo-electron.svg'
import './App.css';


function App() {
  const [count, setCount] = useState(0);
  const platform = useMemo(() => {
    const platform = window.ipcRenderer.sendSync('os') as NodeJS.Platform;
    return platform;
  }, []);

  if (!platform) {
    return (
      <div>
        Somthing went wrong the platform is undefined;
      </div>
    )
  }

  return (
    <div>
      {platform}
    </div>
  )
}

export default App