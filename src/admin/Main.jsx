import React, { useState } from 'react';
import Calendar from './Calendar';
import EmployeeManager from './EmployeeManager';
import tempInitData from './tempInitData';

const Main = () => {
  const [data, setData] = useState(tempInitData);
  const [tab, setTab] = useState('calendar');

  const update = (key, value) => {
    setData((current) => ({ ...current, [key]: value }));
  };

  return (
    <main className="mx-auto max-w-7xl p-4 md:p-6">
      <div className="mb-4 flex gap-2 border-b">
        <button type="button" onClick={() => setTab('calendar')}
          className={`px-4 py-2 ${tab === 'calendar' ? 'border-b-2 border-black font-bold' : 'text-gray-500'}`}>
          휴무 · 자동배치
        </button>
        <button type="button" onClick={() => setTab('employees')}
          className={`px-4 py-2 ${tab === 'employees' ? 'border-b-2 border-black font-bold' : 'text-gray-500'}`}>
          직원관리
        </button>
      </div>

      {tab === 'calendar' ? (
        <Calendar
          employees={data.employees}
          routes={data.routes}
          workRules={data.workRules}
          scheduleOverrides={data.scheduleOverrides}
          fixedDaysOff={data.fixedDaysOff}
          substitutePermissions={data.substitutePermissions}
          substituteWorkHistory={data.substituteWorkHistory}
          onHistoryChange={(value) => update('substituteWorkHistory', value)}
          onScheduleOverridesChange={(value) => update('scheduleOverrides', value)}
        />
      ) : (
        <EmployeeManager
          employees={data.employees}
          teams={data.teams}
          workRules={data.workRules}
          substitutePermissions={data.substitutePermissions}
          onEmployeesChange={(value) => update('employees', value)}
          onWorkRulesChange={(value) => update('workRules', value)}
          onSubstitutePermissionsChange={(value) => update('substitutePermissions', value)}
        />
      )}
    </main>
  );
};

export default Main;
