"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Clock, Minimize2 } from "lucide-react";
import { FridgeBoard } from "./fridge-board";
import { useClockSettings } from "./use-clock-settings";
import { useWakeLock } from "./use-wake-lock";

// 취미 > 냉장고 > 전체 화면(/hobby/fridge/view). 사이드바·머리줄 없이 냉장고만 덮어 씌운다.
// 시계 보기에서 열면(from=clock) 손대지 않는 동안 시계 설정의 "냉장고에서 돌아오기" 시간이
// 지나면 시계 보기로 돌아간다. 시계와 같은 자리에서 쓰는 화면이라 화면 켜짐도 유지한다.
export function FridgeScreen({
  demo = false,
  href,
  fromClock = false,
}: {
  demo?: boolean;
  href: (path: string) => string;
  fromClock?: boolean;
}) {
  const router = useRouter();
  const { settings } = useClockSettings(demo);
  const seconds = fromClock ? settings.fridgeBack : 0;
  const clockUrl = href("/hobby/clock/view");
  // 마지막으로 손댄 시각. 여기에 돌아오기 시간을 더한 때가 되면 시계로 간다.
  const [touched, setTouched] = useState(() => Date.now());
  const deadline = seconds ? touched + seconds * 1000 : 0;
  useWakeLock();

  // 전체 화면이 떠 있는 동안 뒤의 앱 화면이 스크롤되지 않게 한다.
  useEffect(() => {
    document.documentElement.classList.add("fr-open");
    return () => document.documentElement.classList.remove("fr-open");
  }, []);

  // 누르거나 입력하면 돌아오기를 미룬다. 1초 안에 연달아 들어온 것은 흘린다.
  useEffect(() => {
    if (!seconds) return;
    const bump = () =>
      setTouched((t) => (Date.now() - t > 1000 ? Date.now() : t));
    document.addEventListener("pointerdown", bump);
    document.addEventListener("keydown", bump);
    return () => {
      document.removeEventListener("pointerdown", bump);
      document.removeEventListener("keydown", bump);
    };
  }, [seconds]);

  useEffect(() => {
    if (!deadline) return;
    const timer = setTimeout(
      () => router.push(clockUrl),
      Math.max(0, deadline - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [deadline, clockUrl, router]);

  return (
    <div className="fr-screen">
      <FridgeBoard
        demo={demo}
        href={href}
        full
        action={
          fromClock ? (
            <BackToClock deadline={deadline} clockUrl={clockUrl} />
          ) : (
            <Link className="fr-screen-exit" href={href("/hobby/fridge")}>
              <Minimize2 size={16} />
              나가기
            </Link>
          )
        }
      />
    </div>
  );
}

// 시계로 돌아가는 버튼. 자동으로 돌아올 때까지 남은 시간을 같이 보여준다.
function BackToClock({
  deadline,
  clockUrl,
}: {
  deadline: number;
  clockUrl: string;
}) {
  // 남은 시간은 그릴 때 계산하고, 1초마다 다시 그리기만 한다.
  const [, tick] = useState(0);
  useEffect(() => {
    if (!deadline) return;
    const timer = setInterval(() => tick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, [deadline]);
  const left = remaining(deadline);
  return (
    <Link className="fr-screen-exit" href={clockUrl}>
      <Clock size={16} />
      시계로
      {deadline > 0 && <small>{left}</small>}
    </Link>
  );
}

function remaining(deadline: number) {
  if (!deadline) return "";
  const left = Math.max(0, Math.round((deadline - Date.now()) / 1000));
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}`;
}
