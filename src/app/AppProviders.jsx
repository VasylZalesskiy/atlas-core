import {AuthProvider} from "../features/auth/AuthProvider";
import {LocaleProvider} from "../i18n";
import {QueryDraftProvider} from "./QueryDraftProvider";
import {PassportProvider} from "../features/passport/PassportProvider";

export default function AppProviders({children}){return <LocaleProvider><AuthProvider><PassportProvider><QueryDraftProvider>{children}</QueryDraftProvider></PassportProvider></AuthProvider></LocaleProvider>}
