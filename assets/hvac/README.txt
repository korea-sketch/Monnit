HVAC 디지털 트윈 이미지 자산 폴더
------------------------------------
아래 파일을 이 폴더에 넣으면 SVG 기본 렌더링 위에 실제 설비 이미지가 자동으로 겹쳐집니다.
파일이 없으면 SVG fallback이 그대로 표시됩니다(깨진 이미지 아이콘 없음).

expected files (webp/png):
  ahu_frame.webp          AHU 외함(빈 프레임)
  damper_frame.webp       외기댐퍼 프레임
  damper_blades.webp      외기댐퍼 날개(회전/각도 레이어)
  prefilter_clogged.webp  막힌 프리필터
  cooling_coil_body.webp  냉방코일 본체
  cooling_coil_glow.webp  냉방코일 글로우(청색)
  heating_coil_body.webp  난방코일 본체(대기시 어둡게)
  heating_coil_glow.webp  난방코일 글로우(주황, 기본 opacity 0)
  fan_housing.webp        급기팬 하우징(고정)
  fan_blades.webp         급기팬 날개(회전 레이어)
  indoor_room.webp        실내 공간
  return_air_duct.webp    환기 덕트(반투명)
