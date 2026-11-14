import React from 'react';

const STATUS_LABELS = {
    pending: '대기 중',
    accepted: '교환 완료',
    declined: '거절됨',
    cancelled: '취소됨'
};

function statusClass(status) {
    if (status === 'accepted') return 'bg-green-100 text-green-800';
    if (status === 'declined' || status === 'cancelled') return 'bg-gray-100 text-gray-600';
    return 'bg-amber-100 text-amber-800';
}

export default function MyExchange({ myPosts = [], loading, busyId, memberNames = {}, onCancel }) {
    return (
        <section>
            <h3 className="text-lg font-semibold mb-3">내가 보낸 교환 신청</h3>
            {loading && myPosts.length === 0 ? (
                <p className="text-sm text-gray-500 py-3">불러오는 중...</p>
            ) : myPosts.length === 0 ? (
                <p className="text-sm text-gray-500 py-3">보낸 교환 신청이 없습니다. 달력에서 신청할 수 있습니다.</p>
            ) : (
                <div className="space-y-3">
                    {myPosts.map((post) => (
                        <article key={post.id} className="rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="text-sm font-bold">받는 사람: {memberNames[post.receiver_id] || '팀원'}</p>
                                    <p className="mt-1 text-sm text-gray-700 dark:text-gray-200">
                                        {post.source_date} <span className="px-1 text-indigo-500">→</span> {post.target_date}
                                    </p>
                                    <p className="mt-1 text-xs text-gray-500">내 휴무를 희망 날짜로 교환 요청</p>
                                </div>
                                <span className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${statusClass(post.status)}`}>
                                    {STATUS_LABELS[post.status] || post.status}
                                </span>
                            </div>
                            {post.status === 'pending' && (
                                <button
                                    type="button"
                                    onClick={() => onCancel(post.id)}
                                    disabled={busyId === post.id}
                                    className="mt-3 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-semibold disabled:opacity-50 dark:border-gray-600"
                                >
                                    {busyId === post.id ? '처리 중...' : '신청 취소'}
                                </button>
                            )}
                        </article>
                    ))}
                </div>
            )}
        </section>
    );
}
