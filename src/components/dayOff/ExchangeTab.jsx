import React, { useState, useEffect } from 'react';
import MyExchange from './MyExchange';
import ExchangeFeed from './ExchangeFeed';
import { supabase } from '../../lib/supabaseClient';

const ExchangeTab = ({ currentUser, teamId, refreshCalendar }) => {
  const [myPosts, setMyPosts] = useState([]); 
  const [marketFeeds, setMarketFeeds] = useState([]);

 const fetchExchangeData = async () => {
    try {
      // 1. 내가 올린 교환 글과 받은 신청 내역 조회
      const { data: myPostsData, error: myPostsError } = await supabase
        .from('day_off_exchanges')
        .select(`
          id, give_date, want_date, status,
          proposals:exchange_proposals (
            id, offer_date, status, proposer_id,
            profiles:proposer_id (display_name, account_id)
          )
        `)
        .eq('requester_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (myPostsData) setMyPosts(myPostsData);

      // 2. 다른 팀원들이 올린 PENDING 상태의 피드 조회
      const { data: feedData, error: feedError } = await supabase
        .from('day_off_exchanges')
        .select(`
          id, give_date, want_date, status, requester_id,
          profiles:requester_id (display_name, account_id)
        `)
        .eq('team_id', teamId)
        .eq('status', 'PENDING')
        .neq('requester_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (feedData) setMarketFeeds(feedData);

    } catch (error) {
      console.error('교환 데이터 로드 실패:', error);
    }
  };
  useEffect(() => {
    fetchExchangeData();
  }, [teamId]);

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">휴무 교환 마켓</h2>
      
      <MyExchange 
        currentUser={currentUser} 
        myPosts={myPosts} 
        refreshData={fetchExchangeData} 
        teamId={teamId}
        refreshCalendar={refreshCalendar}
      />

      <hr className="my-6 border-gray-300" />

      <ExchangeFeed 
        currentUser={currentUser} 
        marketFeeds={marketFeeds} 
        refreshData={fetchExchangeData} 
      />
    </div>
  );
};

export default ExchangeTab;