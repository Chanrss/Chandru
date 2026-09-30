import React, { useState, useEffect, useRef } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight, 
  Check, 
  CalendarDays
} from 'lucide-react';

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

interface MonthlyCalendarPickerProps {
  startDate: string;
  endDate: string;
  onChange: (range: DateRange) => void;
  className?: string;
  align?: 'left' | 'right';
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const SHORT_MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const DAYS_OF_WEEK = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

// Helpers
function formatToYMD(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseYMD(str: string): Date {
  if (!str) return new Date();
  const parts = str.split('-').map(Number);
  if (parts.length === 3) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  return new Date();
}

function formatReadable(ymd: string): string {
  if (!ymd) return '';
  const d = parseYMD(ymd);
  return `${SHORT_MONTH_NAMES[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

export const MonthlyCalendarPicker: React.FC<MonthlyCalendarPickerProps> = ({
  startDate,
  endDate,
  onChange,
  className = '',
  align = 'right'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse current view month and year
  const initialDate = startDate ? parseYMD(startDate) : new Date();
  const [viewYear, setViewYear] = useState<number>(initialDate.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(initialDate.getMonth()); // 0-11

  // Temporary selection state while interacting
  const [tempStart, setTempStart] = useState<string>(startDate);
  const [tempEnd, setTempEnd] = useState<string>(endDate);
  const [isSelectingEnd, setIsSelectingEnd] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'calendar' | 'months' | 'years'>('calendar');

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Sync state when props change
  useEffect(() => {
    setTempStart(startDate);
    setTempEnd(endDate);
    if (startDate) {
      const d = parseYMD(startDate);
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [startDate, endDate]);

  const handlePrevYear = () => setViewYear((y) => y - 1);
  const handleNextYear = () => setViewYear((y) => y + 1);

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // Generate days grid for current viewMonth and viewYear
  const getCalendarDays = () => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
    const lastDayOfMonth = new Date(viewYear, viewMonth + 1, 0);

    // In JS, getDay(): 0 = Sun, 1 = Mon ... 6 = Sat
    // Monday = 0, Sunday = 6
    let startDayIndex = (firstDayOfMonth.getDay() + 6) % 7;
    const totalDaysInMonth = lastDayOfMonth.getDate();

    // Previous month filler days
    const prevMonthLastDay = new Date(viewYear, viewMonth, 0).getDate();
    const days: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

    for (let i = startDayIndex - 1; i >= 0; i--) {
      const d = new Date(viewYear, viewMonth - 1, prevMonthLastDay - i);
      days.push({
        dateStr: formatToYMD(d),
        dayNum: prevMonthLastDay - i,
        isCurrentMonth: false
      });
    }

    // Current month days
    for (let i = 1; i <= totalDaysInMonth; i++) {
      const d = new Date(viewYear, viewMonth, i);
      days.push({
        dateStr: formatToYMD(d),
        dayNum: i,
        isCurrentMonth: true
      });
    }

    // Next month filler to complete rows (multiples of 7)
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(viewYear, viewMonth + 1, i);
      days.push({
        dateStr: formatToYMD(d),
        dayNum: i,
        isCurrentMonth: false
      });
    }

    return days;
  };

  const handleDateClick = (dateStr: string) => {
    if (!isSelectingEnd) {
      // First click: select start date
      setTempStart(dateStr);
      setTempEnd(dateStr);
      setIsSelectingEnd(true);
    } else {
      // Second click: select end date
      if (dateStr < tempStart) {
        setTempStart(dateStr);
        setTempEnd(tempStart);
      } else {
        setTempEnd(dateStr);
      }
      setIsSelectingEnd(false);
    }
  };

  const applyPreset = (type: 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'this_year' | 'last_30') => {
    const today = new Date();
    let s = new Date();
    let e = new Date();

    if (type === 'today') {
      s = today;
      e = today;
    } else if (type === 'yesterday') {
      s = new Date(today);
      s.setDate(today.getDate() - 1);
      e = new Date(s);
    } else if (type === 'this_week') {
      const day = today.getDay();
      const diff = (day + 6) % 7; // Monday
      s = new Date(today);
      s.setDate(today.getDate() - diff);
      e = today;
    } else if (type === 'this_month') {
      s = new Date(today.getFullYear(), today.getMonth(), 1);
      e = today;
    } else if (type === 'last_month') {
      s = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      e = new Date(today.getFullYear(), today.getMonth(), 0);
    } else if (type === 'last_30') {
      s = new Date(today);
      s.setDate(today.getDate() - 30);
      e = today;
    } else if (type === 'this_year') {
      s = new Date(today.getFullYear(), 0, 1);
      e = today;
    }

    const startYMD = formatToYMD(s);
    const endYMD = formatToYMD(e);
    setTempStart(startYMD);
    setTempEnd(endYMD);
    setViewYear(s.getFullYear());
    setViewMonth(s.getMonth());
    setIsSelectingEnd(false);
  };

  const handleApply = () => {
    onChange({
      startDate: tempStart,
      endDate: tempEnd
    });
    setIsOpen(false);
  };

  const todayStr = formatToYMD(new Date());

  // Generate Year options (current - 8 to current + 4)
  const currentYear = new Date().getFullYear();
  const yearList = Array.from({ length: 12 }, (_, i) => currentYear - 8 + i);

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      {/* Interactive Trigger Button */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setViewMode('calendar');
        }}
        className="flex items-center gap-2 bg-slate-950 hover:bg-slate-900 border border-slate-700 hover:border-amber-500/70 text-slate-100 px-3 py-1.5 rounded-lg text-xs font-mono shadow-sm transition-all cursor-pointer group"
      >
        <CalendarIcon className="w-3.5 h-3.5 text-amber-400 group-hover:scale-110 transition-transform" />
        <span className="font-semibold text-slate-200">
          {formatReadable(startDate)}
        </span>
        <span className="text-slate-500 font-sans">to</span>
        <span className="font-semibold text-slate-200">
          {formatReadable(endDate)}
        </span>
      </button>

      {/* Calendar Dropdown Popover */}
      {isOpen && (
        <>
          {/* Mobile backdrop for outside tap */}
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-2xs z-40 sm:hidden"
            onClick={() => setIsOpen(false)}
          />

          <div
            className={`fixed sm:absolute top-20 sm:top-full mt-1 sm:mt-2 left-2 right-2 sm:left-auto ${
              align === 'right' ? 'sm:right-0' : 'sm:left-0'
            } z-50 bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-3 sm:p-4 max-w-[360px] sm:w-[380px] mx-auto sm:mx-0 text-slate-100 animate-in fade-in zoom-in-95 duration-150`}
          >
            {/* Quick Presets Bar */}
            <div className="flex flex-wrap gap-1 pb-2.5 mb-2.5 sm:pb-3 sm:mb-3 border-b border-slate-800 text-[10.5px] sm:text-[11px]">
              <button
                type="button"
                onClick={() => applyPreset('today')}
                className="px-2 sm:px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-md font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                Today
              </button>
              <button
                type="button"
                onClick={() => applyPreset('yesterday')}
                className="px-2 sm:px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-md font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                Yesterday
              </button>
              <button
                type="button"
                onClick={() => applyPreset('this_month')}
                className="px-2 sm:px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-md font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                This Month
              </button>
              <button
                type="button"
                onClick={() => applyPreset('last_month')}
                className="px-2 sm:px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-md font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                Last Month
              </button>
              <button
                type="button"
                onClick={() => applyPreset('last_30')}
                className="px-2 sm:px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-md font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                Last 30D
              </button>
              <button
                type="button"
                onClick={() => applyPreset('this_year')}
                className="px-2 sm:px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-md font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                This Year
              </button>
            </div>

          {/* Month & Year Navigation Header */}
          <div className="flex items-center justify-between mb-3 px-1">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevYear}
                title="Previous Year"
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handlePrevMonth}
                title="Previous Month"
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>

            {/* Selectable Month & Year Controls */}
            <div className="flex items-center gap-1.5 font-bold text-sm">
              <button
                type="button"
                onClick={() => setViewMode(viewMode === 'months' ? 'calendar' : 'months')}
                className={`px-2 py-1 rounded-md transition-colors ${
                  viewMode === 'months' 
                    ? 'bg-amber-500 text-slate-950 font-extrabold' 
                    : 'hover:bg-slate-800 text-amber-400'
                }`}
              >
                {MONTH_NAMES[viewMonth]}
              </button>

              <button
                type="button"
                onClick={() => setViewMode(viewMode === 'years' ? 'calendar' : 'years')}
                className={`px-2 py-1 rounded-md transition-colors ${
                  viewMode === 'years' 
                    ? 'bg-amber-500 text-slate-950 font-extrabold' 
                    : 'hover:bg-slate-800 text-slate-200'
                }`}
              >
                {viewYear}
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleNextMonth}
                title="Next Month"
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleNextYear}
                title="Next Year"
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* VIEW: Month Selector Grid */}
          {viewMode === 'months' && (
            <div className="grid grid-cols-3 gap-2 py-2 mb-3">
              {MONTH_NAMES.map((name, idx) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    setViewMonth(idx);
                    setViewMode('calendar');
                  }}
                  className={`py-2 px-1 rounded-lg text-xs font-bold transition-colors ${
                    viewMonth === idx
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200'
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          )}

          {/* VIEW: Year Selector Grid */}
          {viewMode === 'years' && (
            <div className="grid grid-cols-4 gap-2 py-2 mb-3">
              {yearList.map((y) => (
                <button
                  key={y}
                  type="button"
                  onClick={() => {
                    setViewYear(y);
                    setViewMode('calendar');
                  }}
                  className={`py-2 px-1 rounded-lg text-xs font-mono font-bold transition-colors ${
                    viewYear === y
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-slate-800/80 hover:bg-slate-700 text-slate-200'
                  }`}
                >
                  {y}
                </button>
              ))}
            </div>
          )}

          {/* VIEW: Monthly Calendar Grid */}
          {viewMode === 'calendar' && (
            <div className="mb-3">
              {/* Day Headers (Mon - Sun) */}
              <div className="grid grid-cols-7 gap-1 text-center font-mono text-[10px] text-slate-400 font-bold mb-1">
                {DAYS_OF_WEEK.map((d) => (
                  <div key={d} className="py-1">
                    {d}
                  </div>
                ))}
              </div>

              {/* Day Numbers */}
              <div className="grid grid-cols-7 gap-1">
                {getCalendarDays().map(({ dateStr, dayNum, isCurrentMonth }, idx) => {
                  const isStart = dateStr === tempStart;
                  const isEnd = dateStr === tempEnd;
                  const isBetween = tempStart && tempEnd && dateStr > tempStart && dateStr < tempEnd;
                  const isToday = dateStr === todayStr;

                  let cellClass = 'hover:bg-slate-800 text-slate-200';

                  if (isStart || isEnd) {
                    cellClass = 'bg-amber-500 text-slate-950 font-extrabold shadow-md scale-105 z-10';
                  } else if (isBetween) {
                    cellClass = 'bg-amber-500/20 text-amber-200 font-semibold';
                  } else if (!isCurrentMonth) {
                    cellClass = 'text-slate-600 hover:text-slate-400';
                  }

                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => handleDateClick(dateStr)}
                      className={`h-8 flex items-center justify-center rounded-lg text-xs font-mono transition-all relative ${cellClass}`}
                    >
                      <span>{dayNum}</span>
                      {isToday && !isStart && !isEnd && (
                        <div className="absolute bottom-1 w-1 h-1 rounded-full bg-amber-400" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Selection Status & Action Footer */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2 text-xs">
            <div className="text-[11px] text-slate-400 leading-tight">
              <div>
                <span className="text-slate-500">From:</span> <strong className="text-slate-200 font-mono">{formatReadable(tempStart)}</strong>
              </div>
              <div>
                <span className="text-slate-500">To:</span> <strong className="text-slate-200 font-mono">{formatReadable(tempEnd)}</strong>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg text-xs cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApply}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1 cursor-pointer shadow-md transition-colors"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Apply</span>
              </button>
            </div>
          </div>
        </div>
      </>
    )}
  </div>
);
};
