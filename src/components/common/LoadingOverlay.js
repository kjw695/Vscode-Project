import React from 'react';

const LoadingOverlay = ({ isLoading, loadingMessage, logoImage }) => {
    if (!isLoading) return null;

    return (
        <>
            <style>
                {`
                @keyframes logo-run {
                    0% { transform: translateX(-100px) scaleX(1); }
                    45% { transform: translateX(100px) scaleX(1); }
                    50% { transform: translateX(100px) scaleX(-1); }
                    95% { transform: translateX(-100px) scaleX(-1); }
                    100% { transform: translateX(-100px) scaleX(1); }
                }
                .running-logo {
                    animation: logo-run 2s infinite linear;
                    width: 80px;
                    height: 80px;
                }
                `}
            </style>
            <div className="fixed inset-0 bg-gray-900 bg-opacity-75 flex flex-col items-center justify-center z-[9999]">
                <div className="relative w-full flex justify-center items-center overflow-hidden mb-4" style={{ height: '100px' }}>
                    <img 
                        src={logoImage} 
                        alt="Running Logo" 
                        className="running-logo" 
                    />
                </div>
                <p className="text-white text-xl font-bold animate-pulse text-center px-4">
                    {loadingMessage}
                </p>
                <div className="w-48 h-1 bg-gray-600 rounded-full mt-2 opacity-50"></div>
            </div>
        </>
    );
};

export default LoadingOverlay;