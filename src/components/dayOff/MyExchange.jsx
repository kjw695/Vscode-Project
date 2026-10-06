import React from 'react';
import { supabase } from '../../lib/supabaseClient';
const MyExchange = ({ currentUser, myPosts, refreshData, teamId, refreshCalendar }) => {

const handleRegisterPost = async (giveDate, wantDate) => {
    if (!giveDate) return alert('내놓을 휴무일을 선택해주세요.');

    const { error } = await supabase
      .from('day_off_exchanges')
      .insert([
        {
          team_id: teamId, 
          requester_id: currentUser.id,
          give_date: giveDate,
          want_date: wantDate || null,
          status: 'PENDING'
        }
      ]);

    if (error) {
      console.error('등록 에러:', error);
    } else {
      alert('휴무 교환이 마켓에 등록되었습니다.');
      refreshData(); 
    }
  };

const handleAcceptProposal = async (proposalId, exchangeId, proposerId, offerDate, giveDate) => {
    const confirmAccept = window.confirm(`[${offerDate}] 휴무 제안을 수락하시겠습니까?`);
    if (!confirmAccept) return;

    try {
      await supabase
        .from('exchange_proposals')
        .update({ status: 'ACCEPTED' })
        .eq('id', proposalId);

      await supabase
        .from('day_off_exchanges')
        .update({ status: 'COMPLETED' })
        .eq('id', exchangeId);

      // 내 휴무(giveDate)를 제안자(proposerId)의 소유로 변경
      await supabase
        .from('day_offs')
        .update({ user_id: proposerId })
        .match({ user_id: currentUser.id, date: giveDate });

      // 제안자의 휴무(offerDate)를 내(currentUser.id) 소유로 변경
      await supabase
        .from('day_offs')
        .update({ user_id: currentUser.id })
        .match({ user_id: proposerId, date: offerDate });

      alert('교환이 완료되었습니다.');
      refreshData();
      if (refreshCalendar) refreshCalendar();
    } catch (error) {
      console.error('교환 수락 처리 중 오류 발생:', error);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">내 교환 현황</h3>
        <button onClick={handleRegisterPost} className="bg-blue-500 text-white px-3 py-1 rounded">
          내 휴무 내놓기
        </button>
      </div>

      <div>
        {myPosts.length === 0 ? (
          <p className="text-gray-500">진행 중인 내 교환 내역이 없습니다.</p>
        ) : (
          myPosts.map((post) => (
            <div key={post.id} className="border p-3 mb-2 rounded bg-gray-50">
              <p>내놓은 날: {post.give_date} / 원하는 날: {post.want_date || '상관없음'}</p>
              
              {post.proposals && post.proposals.map(proposal => (
                <div key={proposal.id} className="mt-2 p-2 bg-white border border-blue-200 rounded flex justify-between">
                  <span>
                    <span className="font-bold">{proposal.user_name}({proposal.nickname})</span>님이 
                    [{proposal.offer_date}] 휴무를 제안했습니다.
                  </span>
                  <button 
                    onClick={() => handleAcceptProposal(proposal.id, post.id)}
                    className="bg-green-500 text-white px-2 py-1 rounded text-sm"
                  >
                    수락
                  </button>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MyExchange;