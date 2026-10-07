import React, { useState } from 'react';
import Calendar from './Calendar';
import tempInitData from './tempInitData';

const Main = () => {
  const [data, setData] = useState(tempInitData);

  const updateHistory = (history) => {
    setData((current) => ({
      ...current,
      substituteWorkHistory: history,
    }));
  };

  const updateScheduleOverrides = (scheduleOverrides) => {
    setData((current) => ({
      ...current,
      scheduleOverrides,
    }));
  };

  return (
    <main className="mx-auto max-w-7xl p-4 md:p-6">
      <Calendar
        employees={data.employees}
        routes={data.routes}
        workRules={data.workRules}
        scheduleOverrides={data.scheduleOverrides}
        fixedDaysOff={data.fixedDaysOff}
        substitutePermissions={data.substitutePermissions}
        substituteWorkHistory={data.substituteWorkHistory}
        onHistoryChange={updateHistory}
        onScheduleOverridesChange={updateScheduleOverrides}
      />
    </main>
  );
};

export default Main;
