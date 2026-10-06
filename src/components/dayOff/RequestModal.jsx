import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

const RequestModal = ({ post, currentUser, onClose, refreshData }) => {
  const [myDayOffs, setMyDayOffs] = useState([]);
  const [selectedOfferDate, setSelectedOfferDate] = useState('');

  useEffect(() => {
    // 1. currentUser의 예정된 휴무일 목록을 DB에서 불러와서 myDayOffs에 셋팅
  }, [currentUser]);

const handleSubmit = async () => {
    const { error } = await supabase
      .from('exchange_proposals')
      .insert([
        {
          exchange_id: post.id,
          proposer_id: currentUser.id,
          offer_date: selectedOfferDate,
          status: 'WAITING'
        }
      ]);

    if (error) {
      console.error('신청 에러:', error);
    } else {
      alert('교환 신청이 완료되었습니다.');
      refreshData();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center">
      <div className="bg-white p-6 rounded shadow-lg w-96">
        <h3 className="text-lg font-bold mb-4">교환 신청하기</h3>
        <p className="mb-4">
          <span className="font-bold">{post.user_name}</span>님에게 제안할 내 휴무일을 선택하세요.
        </p>

        <select 
          className="w-full border p-2 mb-4" 
          value={selectedOfferDate} 
          onChange={(e) => setSelectedOfferDate(e.target.value)}
        >
          <option value="">-- 날짜 선택 --</option>
          {myDayOffs.map(date => (
            <option key={date} value={date}>{date}</option>
          ))}
        </select>

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="bg-gray-300 px-4 py-2 rounded">취소</button>
          <button onClick={handleSubmit} className="bg-blue-500 text-white px-4 py-2 rounded" disabled={!selectedOfferDate}>
            신청
          </button>
        </div>
      </div>
    </div>
  );
};

export default RequestModal;