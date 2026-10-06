import React, { useState } from 'react';
import RequestModal from './RequestModal'; 

const ExchangeFeed = ({ currentUser, marketFeeds, refreshData }) => {
  const [selectedPost, setSelectedPost] = useState(null);

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">팀원들의 교환 요청</h3>
      
      <div className="grid gap-4">
        {marketFeeds.length === 0 ? (
          <p className="text-gray-500">현재 마켓에 올라온 휴무가 없습니다.</p>
        ) : (
          marketFeeds.map((post) => (
            <div key={post.id} className="border p-4 rounded flex justify-between items-center">
              <div>
                <p className="font-bold text-lg">{post.user_name}({post.nickname})</p>
                <p className="text-gray-700">
                  <span className="text-red-500 font-semibold">[포기]</span> {post.give_date} ➔ 
                  <span className="text-blue-500 font-semibold ml-2">[희망]</span> {post.want_date || '아무 날이나'}
                </p>
              </div>
              <button 
                onClick={() => setSelectedPost(post)}
                className="bg-indigo-500 text-white px-4 py-2 rounded"
              >
                교환 신청
              </button>
            </div>
          ))
        )}
      </div>

      {selectedPost && (
        <RequestModal 
          post={selectedPost} 
          currentUser={currentUser} 
          onClose={() => setSelectedPost(null)}
          refreshData={refreshData}
        />
      )}
    </div>
  );
};

export default ExchangeFeed;