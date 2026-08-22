import SearchHistoryList from "../components/SearchHistoryList";

export default function Requests({lang="uk"}){
  return <main className="page appPage requestsPage"><section>
    <span className="kicker">ATLAS · {lang==="uk"?"ПАСПОРТ ПОТРЕБ":"NEEDS PASSPORT"}</span>
    <h1>{lang==="uk"?"Мої запити":"My requests"}</h1>
    <p>{lang==="uk"
      ?"Тут зберігаються ваші попередні пошуки. Відкрийте будь-який запит, щоб повторити або уточнити його."
      :"Your previous searches are saved here. Open any request to repeat or refine it."}</p>
    <SearchHistoryList lang={lang}/>
    <small className="historyPrivacy">{lang==="uk"
      ?"Історія цього тесту зберігається лише на вашому телефоні або комп’ютері."
      :"For this test, history is stored only on your phone or computer."}</small>
  </section></main>;
}
