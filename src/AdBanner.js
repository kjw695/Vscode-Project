// src/AdBanner.js

import React, { useEffect } from 'react';

const AdBanner = ({ 'data-ad-client': dataAdClient, 'data-ad-slot': dataAdSlot, 'data-ad-format': dataAdFormat, 'data-full-width-responsive': dataFullWidthResponsive }) => {
  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      console.error("AdSense error:", e);
    }
  }, []);

  return (
    <div style={{ textAlign: 'center', margin: '0' }}>
      <ins 
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={dataAdClient}
        data-ad-slot={dataAdSlot}
        data-ad-format={dataAdFormat}
        data-full-width-responsive={dataFullWidthResponsive}
      />
    </div>
  );
};

export default AdBanner;