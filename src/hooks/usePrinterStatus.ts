import { useState, useEffect } from 'react';
import { PrinterStatusService, PrinterHealthCheck } from '../services/printerStatusService';
import { RestaurantSettings } from '../types';

export function usePrinterStatus(settings?: RestaurantSettings): {
  health: PrinterHealthCheck;
  runTestPrint: () => { success: boolean; restrictedInIframe?: boolean; error?: string };
  refresh: () => void;
} {
  const [health, setHealth] = useState<PrinterHealthCheck>(() => 
    PrinterStatusService.getHealthCheck(settings)
  );

  useEffect(() => {
    const unsub = PrinterStatusService.subscribe((latest) => {
      setHealth(latest);
    });
    return unsub;
  }, [settings]);

  const runTestPrint = () => {
    const res = PrinterStatusService.testPrint(settings);
    // Refresh health after test run
    setHealth(PrinterStatusService.getHealthCheck(settings));
    return res;
  };

  const refresh = () => {
    setHealth(PrinterStatusService.getHealthCheck(settings));
  };

  return { health, runTestPrint, refresh };
}
