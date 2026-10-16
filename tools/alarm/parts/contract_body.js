    var now = new Date();
    var body = {
      offerId: OFFER_ID,
      customer: {name:$("c_name").value.trim(), bizNo:$("c_biz").value.trim(), address:$("c_addr").value.trim(),
                 ceo:$("c_ceo").value.trim(), contractType:$("c_type").value,
                 manager:$("c_mgr").value.trim(), phone:$("c_tel").value.trim(),
                 email:$("c_mail").value.trim(), site:$("c_site").value.trim()},
      recipients: recvs(),
      slaViewedAt: slaViewedAt,
      slaAgreedAt: slaAgreedAt,
      slaReadPct: Math.round(slaReadPct * 100),
      acknowledged: ["제3조 회사가 부담하지 않는 의무","제3조5호 오탐·미탐",
                     "제4조 사용제한·위험인수","제6조 크레딧 부적용",
                     "제10조 책임한도","제11조 면책","제7조 고객의무·기록",
                     "제12·13조 보험·제3자청구·계약기간"],
      signature: {name:$("sg_name").value.trim(), role:$("sg_role").value.trim(),
                  signedOn: ymd(now), image: cv.toDataURL("image/png")},
      attachments: {businessLicense: LIC ? {filename:LIC.name, mimeType:"image/jpeg", image:LIC.dataUrl} : null}
    };

