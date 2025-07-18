// src/components/RankingChart.js

import React from 'react';

function RankingChart({ rankings, isDarkMode, currentUserId }) {
  return (
    <div className="space-y-2">
      {rankings.map((user, index) => {
        const isCurrentUser = user.id === currentUserId;
        return (
          <div
            key={user.id}
            className={`flex items-center justify-between p-3 rounded-lg ${
              isCurrentUser
                ? 'bg-yellow-200 dark:bg-yellow-700'
                : isDarkMode
                ? 'bg-gray-700'
                : 'bg-gray-100'
            }`}
          >
            <div className="flex items-center">
              <span className={`font-bold text-lg w-8 ${isCurrentUser ? 'text-yellow-800 dark:text-yellow-200' : ''}`}>
                {user.rank}위
              </span>
              <span className={`font-semibold ml-4 ${isCurrentUser ? 'text-yellow-900 dark:text-yellow-100' : ''}`}>
                {user.displayName || `사용자 ${index + 1}`}
              </span>
            </div>
            <span className={`font-semibold ${isCurrentUser ? 'text-yellow-900 dark:text-yellow-100' : 'text-blue-500'}`}>
              {user.steps.toLocaleString()} 걸음
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default RankingChart;