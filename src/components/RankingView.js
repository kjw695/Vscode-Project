// src/components/RankingView.js

import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebaseConfig';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import RankingChart from './RankingChart';

// 걸음 수에 따른 예상치 계산 함수
const stepToKm = (steps) => (steps * 0.0007).toFixed(2);
const stepToKcal = (steps) => (steps * 0.04).toFixed(0);

// App.js로부터 dailySteps, isDarkMode를 props로 받아옵니다.
function RankingView({ dailySteps, isDarkMode }) {
    const [rankings, setRankings] = useState([]);
    const [currentUserId, setCurrentUserId] = useState(null);
    const [activeTab, setActiveTab] = useState('pedometer');
    const stepGoal = 15000; // 목표 걸음 수

    useEffect(() => {
        if (auth.currentUser) {
            setCurrentUserId(auth.currentUser.uid);
        }

        if (activeTab === 'pedometer') {
            const today = new Date().toISOString().slice(0, 10);
            const q = query(
                collection(db, `pedometer/${today}/userSteps`),
                orderBy('steps', 'desc'),
                limit(100)
            );

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const newRankings = snapshot.docs.map((doc, index) => ({
                    id: doc.id,
                    rank: index + 1,
                    ...doc.data()
                }));
                setRankings(newRankings);
            });

            return () => unsubscribe();
        }
    }, [activeTab]);

    const progress = Math.min((dailySteps / stepGoal) * 100, 100);

    return (
        <div className="w-full max-w-4xl">
            {/* 탭 버튼 UI */}
            <div className="flex justify-center border-b mb-4">
                <button
                    onClick={() => setActiveTab('pedometer')}
                    className={`py-2 px-6 font-semibold ${activeTab === 'pedometer' ? 'border-b-2 border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}
                >
                    걸음
                </button>
                <button
                    onClick={() => setActiveTab('delivery')}
                    className={`py-2 px-6 font-semibold ${activeTab === 'delivery' ? 'border-b-2 border-blue-500 text-blue-600 dark:border-blue-400 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400'}`}
                >
                    배송
                </button>
            </div>

            {/* 선택된 탭에 따라 다른 내용을 보여줍니다. */}
            {activeTab === 'pedometer' ? (
                <div className="space-y-8">
                    {/* 1. 만보기 UI 섹션 */}
                    <div className={`p-6 rounded-2xl text-center ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'}`}>
                        <h2 className={`text-6xl font-bold mb-4 ${isDarkMode ? 'text-white' : 'text-black'}`}>
                            {dailySteps.toLocaleString()} <span className={`text-4xl font-medium ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>걸음</span>
                        </h2>
                        <div className="relative h-4 w-full bg-gray-600 rounded-full">
                            <div 
                                className="absolute top-0 left-0 h-4 bg-green-500 rounded-full"
                                style={{ width: `${progress}%` }}
                            ></div>
                        </div>
                        <div className="flex justify-between text-xs text-gray-400 mt-1 px-1">
                            <span>0</span>
                            <span>목표: {stepGoal.toLocaleString()}</span>
                        </div>
                        <div className={`flex justify-around mt-8 ${isDarkMode ? 'text-white' : 'text-black'}`}>
                            <div><p className="text-xl font-semibold">{stepToKm(dailySteps)} <span className="text-sm text-gray-400">km</span></p></div>
                            <div className="border-l border-gray-600 h-8"></div>
                            <div><p className="text-xl font-semibold">{stepToKcal(dailySteps)} <span className="text-sm text-gray-400">kcal</span></p></div>
                        </div>
                    </div>

                    {/* 2. 랭킹 목록 섹션 */}
                    <div>
                        <h3 className="text-xl font-bold mb-4 text-center">오늘의 걸음 수 랭킹</h3>
                        <RankingChart 
                            rankings={rankings} 
                            isDarkMode={isDarkMode}
                            currentUserId={currentUserId}
                        />
                    </div>
                </div>
            ) : (
                <div className="text-center py-10">
                    <p className={`text-lg ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                        배송 랭킹은 현재 준비중입니다.
                    </p>
                </div>
            )}
        </div>
    );
}

export default RankingView;