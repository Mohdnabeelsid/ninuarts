import React, { createContext, useContext, useState, useEffect } from "react";
import { ActivePeriod } from "../types";

interface ActivePeriodContextType {
  activePeriod: ActivePeriod;
  setActivePeriodMonth: (year: number, month: number) => void;
  setAllPeriods: () => void;
  resetToCurrentMonth: () => void;
  isCurrentMonth: boolean;
  isAllPeriods: boolean;
  availableMonths: ActivePeriod[];
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

function formatPeriod(year: number, month: number): ActivePeriod {
  const monthStr = month < 10 ? `0${month}` : `${month}`;
  return {
    year,
    month,
    formatted: `${year}-${monthStr}`,
    displayLabel: `${MONTH_NAMES[month - 1]} ${year}`,
  };
}

const ALL_TIME_PERIOD: ActivePeriod = {
  year: 0,
  month: 0,
  formatted: "ALL",
  displayLabel: "All Time (Cumulative)",
};

function getCurrentPeriod(): ActivePeriod {
  const now = new Date();
  return formatPeriod(now.getFullYear(), now.getMonth() + 1);
}

const ActivePeriodContext = createContext<ActivePeriodContextType | undefined>(undefined);

export function ActivePeriodProvider({ children }: { children: React.ReactNode }) {
  const [activePeriod, setActivePeriodState] = useState<ActivePeriod>(() => {
    const saved = localStorage.getItem("ninu_arts_active_period");
    if (saved === "ALL") {
      return ALL_TIME_PERIOD;
    }
    if (saved && /^\d{4}-\d{2}$/.test(saved)) {
      const [y, m] = saved.split("-").map(Number);
      if (m >= 1 && m <= 12) {
        return formatPeriod(y, m);
      }
    }
    return getCurrentPeriod();
  });

  const currentPeriod = getCurrentPeriod();
  const isAllPeriods = activePeriod.formatted === "ALL";
  const isCurrentMonth =
    !isAllPeriods &&
    activePeriod.year === currentPeriod.year &&
    activePeriod.month === currentPeriod.month;

  useEffect(() => {
    localStorage.setItem("ninu_arts_active_period", activePeriod.formatted);
  }, [activePeriod]);

  const setActivePeriodMonth = (year: number, month: number) => {
    setActivePeriodState(formatPeriod(year, month));
  };

  const setAllPeriods = () => {
    setActivePeriodState(ALL_TIME_PERIOD);
  };

  const resetToCurrentMonth = () => {
    setActivePeriodState(getCurrentPeriod());
  };

  // Generate selectable range: 12 months in the past up to 12 months in the future
  const availableMonths: ActivePeriod[] = [];
  const startYear = 2026; // System pilot rollout
  const endYear = 2028;
  for (let y = startYear; y <= endYear; y++) {
    for (let m = 1; m <= 12; m++) {
      availableMonths.push(formatPeriod(y, m));
    }
  }

  return (
    <ActivePeriodContext.Provider
      value={{
        activePeriod,
        setActivePeriodMonth,
        setAllPeriods,
        resetToCurrentMonth,
        isCurrentMonth,
        isAllPeriods,
        availableMonths,
      }}
    >
      {children}
    </ActivePeriodContext.Provider>
  );
}

export function useActivePeriod() {
  const context = useContext(ActivePeriodContext);
  if (!context) {
    throw new Error("useActivePeriod must be used within an ActivePeriodProvider");
  }
  return context;
}
