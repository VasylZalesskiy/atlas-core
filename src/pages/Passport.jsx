import PassportOverview from "../features/passport/PassportOverview";
import Profile from "./Profile";

export default function Passport({t,clearRequest}){return <div className="page passportPage"><PassportOverview t={t}/><details className="legacyProfile"><summary>{t.passport2.legacyTitle}</summary><p>{t.passport2.legacyDescription}</p><Profile t={t} clearRequest={clearRequest}/></details></div>}
