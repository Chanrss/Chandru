# POS Billing Software – Direct Thermal Printing via Google Chrome Kiosk Printing

This POS billing system supports direct silent printing to thermal receipt printers (such as Rugtek RP326, EPSON TM-T82, TVS RP3200, POS-80, POS-58, and all Windows-compatible thermal printers) using **Google Chrome Kiosk Printing** (`--kiosk-printing`).

---

## 1. How Direct Thermal Printing Works

When a bill is completed, a KOT is issued, or a bill is reprinted:
1. The POS generates the formatted receipt HTML (58mm or 80mm).
2. The print command is dispatched via standard browser printing (`contentWindow.print()` / `window.print()`).
3. Google Chrome launched with the `--kiosk-printing` flag intercepts the print call.
4. **NO Chrome Print Preview** is displayed.
5. **NO Print Dialog** is displayed.
6. **NO printer-selection popup** is displayed.
7. The print job is sent **instantly and directly** to the Windows configured default thermal printer.
8. The receipt prints immediately on physical hardware.

---

## 2. Windows PC Setup Instructions

Follow these two simple steps on the Windows cashier/billing computer:

### Step 1: Configure the Thermal Printer as the Windows Default Printer

1. Connect your thermal printer to the Windows PC via USB or Serial.
2. Open Windows **Settings** (`Win + I`) → **Bluetooth & devices** → **Printers & scanners**.
3. Locate your thermal printer (e.g. *Rugtek RP326*, *POS-80*, *TVS RP3200*, *EPSON TM-T82*).
4. Click on the printer and click **"Set as default"**.
5. Click **"Printing preferences"** or **"Printer properties"**:
   - Set **Paper Size** to `80 x 297 mm` (for 80mm / 3-inch printers) or `58 x 210 mm` (for 58mm / 2-inch printers).
   - Set **Margins** to `None` or `0mm`.
   - Ensure **Cut Paper** / **Cash Drawer kick** settings match your hardware preferences.
6. Click **Apply** and **OK**.

---

### Step 2: Create the Chrome Kiosk Printing Shortcut

To enable silent, preview-free printing, Google Chrome must be launched with the `--kiosk-printing` flag.

1. On the Windows Desktop, right-click an empty space.
2. Select **New** → **Shortcut**.
3. In the location/target field, enter:
   ```cmd
   "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing "YOUR_POS_URL"
   ```
   *(Replace `YOUR_POS_URL` with your actual POS URL, e.g., `http://localhost:3000` or your deployed domain)*.

4. Click **Next**, name the shortcut (e.g. `POS Billing - Fast Print`), and click **Finish**.
5. Launch the POS using this shortcut. Every print command will now output directly to the thermal printer with zero dialogs.

#### Path Variations:
If Chrome is installed in a different directory on your Windows machine, use the appropriate path:
- **64-bit Chrome (Default):**
  ```cmd
  "C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk-printing "YOUR_POS_URL"
  ```
- **32-bit Chrome:**
  ```cmd
  "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe" --kiosk-printing "YOUR_POS_URL"
  ```
- **User Profile Installation (Per-user Chrome):**
  ```cmd
  "%LocalAppData%\Google\Chrome\Application\chrome.exe" --kiosk-printing "YOUR_POS_URL"
  ```

#### Optional Full-Screen Lockdown Mode:
If you want the billing computer to run locked in full-screen kiosk mode:
```cmd
"C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --kiosk-printing "YOUR_POS_URL"
```
*(Press `Alt + F4` to exit full-screen kiosk mode)*.

---

## 3. Supported Billing Workflows

All billing flows use direct thermal printing:

- **Direct Billing (Express Cashier):**
  Manager/Cashier punches item codes or taps menu items → Press Enter / Print Bill → Thermal printer prints receipt directly → Cart resets for next customer.

- **KOT Billing (Kitchen Order Tickets):**
  Staff places table / parcel order → KOT generated → Kitchen ticket prints directly to default KOT printer.

- **Duplicate / Reprint by Bill Number:**
  Enter or select bill number in Bill History → Click **Reprint** → Loads bill details & increments duplicate counter → Prints duplicate receipt directly to default thermal printer without opening an on-screen preview modal.

- **Paper Size Support:**
  Both **80mm (3-inch)** and **58mm (2-inch)** paper rolls are supported and can be switched anytime in **Settings → Hardware & Receipt**.

---

## 4. Error Handling & Fallback

If Chrome is launched normally *without* `--kiosk-printing`:
- Browser will show the standard Chrome print dialog, allowing manual printing.
- If a print command fails or is blocked by system policy, the application logs:
  `console.error('Thermal printer print failed:', error)`
  and informs the cashier without crashing or freezing the billing screen.
