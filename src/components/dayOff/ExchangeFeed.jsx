import React from 'react';

const STATUS_LABELS = {
    pending: '응답 필요',
    accepted: '교환 완료',
    declined: '거절함',
    cancelled: '취소됨'
};

function statusClass(status) {
    if (status === 'accepted') return 'bg-green-100 text-green-800';
    if (status === 'declined' || status === 'cancelled') return 'bg-gray-100 text-gray-600';
    return 'bg-amber-100 text-amber-800';
}

export default function ExchangeFeed({ marketFeeds = [], loading, busyId, memberNames = {}, onRespond }) {
    return (
        <section>
            <h3 className="text-lg font-semibold mb-3">내가 받은 교환 신청</h3>
            {loading && marketFeeds.length === 0 ? (
                <p className="text-sm text-gray-500 py-3">불러오는 중...</p>
            ) : marketFeeds.length === 0 ? (
                <p className="text-sm text-gray-500 py-3">받은 교환 신청이 없습니다.</p>
            ) : (
                <div className="space-y-3">
                    {marketFeeds.map((post) => (
                        <article key={post.id} className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-sm font-bold">신청자: {memberNames[post.requester_id] || '팀원'}</p>
                                    <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">
                                        상대방 휴무 {post.source_date} <span className="px-1 text-indigo-500">→</span> 내 휴무 {post.target_date}
                                    </p>
                                    <p className="mt-1 text-xs text-gray-500">수락하면 두 사람의 휴무 날짜가 서로 바뀝니다.</p>
                                </div>
                                <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${statusClass(post.status)}`}>
                                    {STATUS_LABELS[post.status] || post.status}
                                </span>
                            </div>
                            {post.status === 'pending' && (
                                <div className="mt-3 flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => onRespond(post.id, 'accepted')}
                                        disabled={busyId === post.id}
                                        className="flex-1 rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
                                    >
                                        {busyId === post.id ? '처리 중...' : '수락 및 교환'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => onRespond(post.id, 'declined')}
                                        disabled={busyId === post.id}
                                        className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold disabled:opacity-50 dark:border-gray-600"
                                    >
                                        거절
                                    </button>
                                </div>
                            )}
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
}
