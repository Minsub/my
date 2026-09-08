> 원본 요구사항 보존 문서. 현재 구현/작업 순서는 [서비스 기준](../service-design.md)과 [개발 가이드](../development.md)를 따른다. 아래 초기 목록은 실제 재고나 최신 가격이 아니며 자동 상품 수집을 의미하지 않는다.

# 홈카페 설계
내가 집에서 홈카페로 커피를 내려먹는데 필요한 정보를 시각화해서 관리하고싶어.
일단 원두를 계속 변경해가면서 좋은 원두를 기록하고있어.
내가 원하는 데이터 기준을 설명해줄께.
일단 커피 원두를 파는 브랜드 스토어들의 리스트야. 이건단순히 목록만 관리하면 좋겠어.
그리고 원두 제품을 관리하고싶어. 

ai로 mcp를 사용해 원두 / 브랜드 등록하고 조회하고싶어.
이것에 맞게 mcp api구조도 필요해

등록할때는 상품링크를 첨부할꺼야.
https://brand.naver.com/momoscoffee/products/10032632384

html에 보여질땐 상품의 이미지도 같이 보였으면 좋겠어.

## 데이터 구조

### 원두
브랜드 스토어, 제품이름, 가격(1kg기준), 상태(구매예정, 먹어봄), 추천여부 (추천,보통,비추천), 배전(강배전,중배전,약배전), 상품링크, 맛, 내 세팅(먹어본 원두중 내가 사용하는 머신의 세팅기준. ex. 11, 6 처럼 숫자 2개 컬럼. 분쇄도와 용량 ), 내 평가

### 브랜드
브랜드 명, 링크, 설명

## 내가 초기에 저장하고 싶은 정보

### 원두 제품
- 모모스커피 에스쇼콜라 https://brand.naver.com/momoscoffee/products/10011962222
    - 추천
- 모모스커피 프루티봉봉 https://brand.naver.com/momoscoffee/products/10032632384
    - 추천 (11, 6)
- 빈브라더스 블랙수트 https://brand.naver.com/beanbrothers/products/5296043969
    - 보통 (10, 7)
- 빈브라더스 세븐티 블렌드 https://brand.naver.com/beanbrothers/products/7971414842
- 빈브라더스 벨벳화이트 https://brand.naver.com/beanbrothers/products/13458303252
    - 추천 (13, 5)
- 커피 리브레 배드블러드 https://smartstore.naver.com/coffeelibre/products/13140697107
    - 추천 (10, 7)
- 아이덴티티 커피랩 칠린 블렌드 https://smartstore.naver.com/identity_coffeelab/products/4705726740
    - 추천 (13, 6)
- 아이덴티티 커피랩 미드센추리 블렌드 https://smartstore.naver.com/identity_coffeelab/products/6684189550
    - 비추 (12, 5), 딸기향이 많이남
- 헤베커피 밸런스 블렌드 https://brand.naver.com/hebecoffee/products/4976337808 
- 헤베커피 프레쉬 블렌드 https://brand.naver.com/hebecoffee/products/7715276304
    - 비추
- 노다웃 콜롬비아 카르타고 슈가케인 디카페인 다크로스트 https://smartstore.naver.com/nodoubt_coffee/products/5365015136
    - 비추


### 원두 구매 브랜드 
- 커피 리브레: https://smartstore.naver.com/coffeelibre
- 토치커피: https://smartstore.naver.com/toch
- 노다웃커피(중저가): https://smartstore.naver.com/nodoubt_coffee
- 전광수 커피: https://brand.naver.com/jeonscoffeelab
- 180 커피로스터스: http://smartstore.naver.com/180coffeeroasters
- 수달리 커피: https://brand.naver.com/soodalicoffee
- 모모스커피: https://brand.naver.com/momoscoffee
- 빈브라더스: https://brand.naver.com/beanbrothers
- 헤베커피: https://brand.naver.com/hebecoffee
- 아이덴티티 커피랩: https://smartstore.naver.com/identity_coffeelab