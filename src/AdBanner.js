import React from 'react';

const AdBanner = ({ isVisible }) => {
    if (!isVisible) return null;

    const inquirySubject = encodeURIComponent('[택배메이트] 배너 광고 제휴 문의');
    const inquiryMailto = `mailto:kjw891224@gmail.com?subject=${inquirySubject}`;

    // This is a manually managed partnership inquiry banner, not an AdMob ad.
    return (
        <div
            className="fixed left-0 right-0 z-[9998] px-0 pointer-events-none"
            style={{ top: 'max(env(safe-area-inset-top, 0px), 28px)' }}
            aria-label="배너 광고 제휴 문의"
        >
            <div className="flex h-[50px] w-full items-center justify-between border-y border-gray-200 bg-white/95 px-4 shadow-sm pointer-events-auto dark:border-gray-700 dark:bg-gray-800/95">
                <div className="min-w-0 pr-3">
                    <div className="truncate text-xs font-bold text-gray-800 dark:text-gray-100">
                        택배메이트 배너 광고
                    </div>
                    <div className="truncate text-[10px] text-gray-500 dark:text-gray-300">
                        이 영역에 광고를 게재해 보세요
                    </div>
                </div>
                <a
                    href={inquiryMailto}
                    className="shrink-0 rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white active:bg-blue-700"
                >
                    제휴 문의
                </a>
            </div>
        </div>
    );
};

export default AdBanner;
