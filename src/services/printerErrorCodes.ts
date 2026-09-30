import { PrintJobLog } from '../types';

export type ErrorCategory = 'CONNECTION' | 'HARDWARE' | 'BROWSER_SECURITY' | 'SPOOLER' | 'SUCCESS';
export type ErrorSeverity = 'error' | 'warning' | 'success';

export interface PrinterDiagnosticCodeInfo {
  code: string;
  numericCode: number;
  title: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  summary: string;
  rootCause: string;
  remedies: string[];
  suggestedActionLabel?: string;
  isDisconnectionRelated: boolean;
}

export const PRINTER_ERROR_CATALOG: Record<string, PrinterDiagnosticCodeInfo> = {
  ERR_PRINTER_OFFLINE: {
    code: 'ERR_PRINTER_OFFLINE',
    numericCode: 1001,
    title: 'Printer Offline / Power Interrupted',
    category: 'CONNECTION',
    severity: 'error',
    summary: 'The receipt printer is not receiving power or the communication cable is unplugged.',
    rootCause: 'No communication link detected on printer interface.',
    isDisconnectionRelated: true,
    remedies: [
      'Ensure printer power rocker switch is ON and the front panel green POWER LED is illuminated.',
      'Check that the 24V DC power brick barrel connector is firmly seated into the printer rear port.',
      'Unplug and reconnect the USB Type-B or RS-232 cable on both the printer and POS terminal.',
      'If using a USB hub, connect directly into a dedicated computer motherboard USB port instead.'
    ],
    suggestedActionLabel: 'Check Cable & Power LED'
  },
  ERR_PORT_DISCONNECTED: {
    code: 'ERR_PORT_DISCONNECTED',
    numericCode: 1002,
    title: 'Communication Port Disconnected',
    category: 'CONNECTION',
    severity: 'error',
    summary: 'The USB COM virtual port or WebSerial device handle was unexpectedly disconnected.',
    rootCause: 'USB bus reset, OS sleep mode power saving, or cable physical disconnection during transfer.',
    isDisconnectionRelated: true,
    remedies: [
      'Disable "USB Selective Suspend" in Windows Power Options to prevent ports from sleeping.',
      'Open Windows Device Manager -> Ports (COM & LPT) to verify COM port assignment (e.g. COM3 / COM4).',
      'Avoid daisy-chaining USB splitters; thermal printers require stable 500mA USB bus power.'
    ],
    suggestedActionLabel: 'Reopen COM Port'
  },
  ERR_SANDBOX_RESTRICTED: {
    code: 'ERR_SANDBOX_RESTRICTED',
    numericCode: 1003,
    title: 'Sandboxed Iframe Restricted Print',
    category: 'BROWSER_SECURITY',
    severity: 'warning',
    summary: 'Direct window.print() or hardware WebSerial/WebUSB access was blocked by the browser iframe security sandbox.',
    rootCause: 'Application running inside an embedded iframe preview.',
    isDisconnectionRelated: false,
    remedies: [
      'Launch the POS app in a dedicated browser tab (click "Open Standalone Tab").',
      'Use Chrome with the "--kiosk-printing" command line flag for silent zero-dialog thermal printing.'
    ],
    suggestedActionLabel: 'Open in New Tab'
  },
  ERR_SPOOLER_TIMEOUT: {
    code: 'ERR_SPOOLER_TIMEOUT',
    numericCode: 1004,
    title: 'Print Spooler Stalled / Timed Out',
    category: 'SPOOLER',
    severity: 'error',
    summary: 'Operating system print spooler did not complete transmission within the timeout threshold.',
    rootCause: 'Printer spooler service hung or corrupted print job queue.',
    isDisconnectionRelated: true,
    remedies: [
      'Restart the Windows Spooler: Run "net stop spooler && net start spooler" in Administrator CMD.',
      'Clear jammed documents from Windows Settings -> Printers & Scanners -> Open Queue.',
      'Ensure printer queue is not set to "Use Printer Offline".'
    ],
    suggestedActionLabel: 'Restart Spooler'
  },
  ERR_PAPER_EMPTY: {
    code: 'ERR_PAPER_EMPTY',
    numericCode: 1005,
    title: 'Paper Empty or Cover Open',
    category: 'HARDWARE',
    severity: 'error',
    summary: 'The thermal printer paper sensor detects an empty roll or the lid latch is not securely engaged.',
    rootCause: 'End of thermal roll reached or cover latch partially ajar.',
    isDisconnectionRelated: false,
    remedies: [
      'Open the lid, check for red flashing ERROR LED on front panel.',
      'Insert a fresh 80mm/58mm thermal roll with the thermal coated side facing the printhead.',
      'Press lid down firmly on both sides until a distinct double click is heard.'
    ],
    suggestedActionLabel: 'Inspect Paper Roll'
  },
  ERR_POPUP_BLOCKED: {
    code: 'ERR_POPUP_BLOCKED',
    numericCode: 1006,
    title: 'Browser Print Dialog Blocked',
    category: 'BROWSER_SECURITY',
    severity: 'warning',
    summary: 'Browser pop-up blocker suppressed the receipt print window.',
    rootCause: 'Strict popup blocker settings in Chrome/Edge/Firefox.',
    isDisconnectionRelated: false,
    remedies: [
      'Look for the blocked pop-up icon in the browser address bar.',
      'Select "Always allow pop-ups and redirects from this site".'
    ],
    suggestedActionLabel: 'Allow Popups'
  },
  ERR_HANDSHAKE_FAILED: {
    code: 'ERR_HANDSHAKE_FAILED',
    numericCode: 1007,
    title: 'ESC/POS Protocol Handshake Failed',
    category: 'CONNECTION',
    severity: 'error',
    summary: 'Printer failed to respond to the raw ESC/POS initialization command (ESC @).',
    rootCause: 'Baud rate mismatch, parity error, or device in unrecoverable error state.',
    isDisconnectionRelated: true,
    remedies: [
      'Power cycle printer: Turn OFF switch, wait 5 seconds, and power ON to reset FIFO buffer.',
      'Self-Test: Hold FEED button down while turning on power switch to print DIP switch settings and baud rate (Rugtek RP326B default is 19200 bps).',
      'Verify port baud rate matches driver settings.'
    ],
    suggestedActionLabel: 'Run Hardware Self-Test'
  },
  ERR_HARDWARE_BUSY: {
    code: 'ERR_HARDWARE_BUSY',
    numericCode: 1008,
    title: 'Hardware Buffer Saturated',
    category: 'HARDWARE',
    severity: 'warning',
    summary: 'Printer internal FIFO buffer is full or awaiting previous print job completion.',
    rootCause: 'Rapid successive print jobs without hardware flow control.',
    isDisconnectionRelated: false,
    remedies: [
      'Press FEED button once to advance paper and flush internal print buffer.',
      'Ensure a 300ms pause between rapid multi-item billing batches.'
    ],
    suggestedActionLabel: 'Feed Paper'
  },
  SUCCESS_OK: {
    code: 'SUCCESS_OK',
    numericCode: 2000,
    title: 'Print Dispatched Successfully',
    category: 'SUCCESS',
    severity: 'success',
    summary: 'Print stream successfully accepted and dispatched to thermal printer.',
    rootCause: 'Hardware handshake verified, paper ready, printer online.',
    isDisconnectionRelated: false,
    remedies: [
      'Printer operational. Ready for continuous customer billing.'
    ],
    suggestedActionLabel: 'Operational'
  }
};

/**
 * Resolves a PrintJobLog into a structured diagnostic code with actionable troubleshooting remedies.
 */
export function resolvePrinterErrorCode(log: PrintJobLog): PrinterDiagnosticCodeInfo {
  // If explicitly specified and in catalog, return it
  if (log.errorCode && PRINTER_ERROR_CATALOG[log.errorCode]) {
    return PRINTER_ERROR_CATALOG[log.errorCode];
  }

  // Handle SUCCESS state
  if (log.status === 'SUCCESS') {
    return PRINTER_ERROR_CATALOG.SUCCESS_OK;
  }

  // Handle RESTRICTED state
  if (log.status === 'RESTRICTED') {
    return PRINTER_ERROR_CATALOG.ERR_SANDBOX_RESTRICTED;
  }

  // Handle FAILURE state by parsing error message
  const msg = (log.errorMessage || '').toLowerCase();

  if (msg.includes('port') || msg.includes('serial') || msg.includes('com') || msg.includes('usb') || msg.includes('detached')) {
    return PRINTER_ERROR_CATALOG.ERR_PORT_DISCONNECTED;
  }
  if (msg.includes('paper') || msg.includes('cover') || msg.includes('lid') || msg.includes('roll')) {
    return PRINTER_ERROR_CATALOG.ERR_PAPER_EMPTY;
  }
  if (msg.includes('spooler') || msg.includes('timeout') || msg.includes('timed out') || msg.includes('queue')) {
    return PRINTER_ERROR_CATALOG.ERR_SPOOLER_TIMEOUT;
  }
  if (msg.includes('handshake') || msg.includes('esc') || msg.includes('pos') || msg.includes('baud')) {
    return PRINTER_ERROR_CATALOG.ERR_HANDSHAKE_FAILED;
  }
  if (msg.includes('busy') || msg.includes('overflow') || msg.includes('buffer')) {
    return PRINTER_ERROR_CATALOG.ERR_HARDWARE_BUSY;
  }
  if (msg.includes('popup') || msg.includes('blocked')) {
    return PRINTER_ERROR_CATALOG.ERR_POPUP_BLOCKED;
  }
  if (msg.includes('iframe') || msg.includes('sandbox')) {
    return PRINTER_ERROR_CATALOG.ERR_SANDBOX_RESTRICTED;
  }

  // Default connection error
  return PRINTER_ERROR_CATALOG.ERR_PRINTER_OFFLINE;
}
