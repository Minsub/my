-- 분할매수 종목을 ISA 계좌로 살지 표시한다. 기존 종목은 ISA가 아닌 것으로 둔다.
ALTER TABLE asset_buy_plan_items ADD COLUMN isa boolean NOT NULL DEFAULT false;
