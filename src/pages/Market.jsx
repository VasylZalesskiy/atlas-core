import {ShoppingBag} from "lucide-react";

export default function Market(){
  return <main className="page appPage"><section className="profileShell marketPage">
    <span className="kicker">ATLAS · ОКРЕМИЙ РОЗДІЛ</span>
    <h1>Куплю / Продам</h1>
    <div className="marketNotice"><ShoppingBag size={30}/><div><strong>Оголошення винесені з Паспортa</strong><p>Тут буде окремий обмін товарами. Спочатку тестуємо Паспорти можливостей і приватний чат, потім підключимо цей розділ до пошуку.</p></div></div>
  </section></main>;
}
