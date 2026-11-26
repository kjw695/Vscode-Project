// Advertising is disabled for the Korea launch.
// Keep the existing handler contract so the statistics screens remain unchanged.
export const useAdReward = ({ setStatisticsView }) => {
    const handleProtectedTabClick = (targetTab) => {
        setStatisticsView(targetTab);
    };

    return { handleProtectedTabClick };
};
