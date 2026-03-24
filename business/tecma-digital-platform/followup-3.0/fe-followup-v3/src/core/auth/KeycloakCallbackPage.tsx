import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { followupApi } from "../../api/followupApi";
import { setTokens } from "../../api/http";
import {
  consumeStoredOidcBackTo,
  exchangeKeycloakAuthorizationCode,
  isKeycloakOidcConfigured
} from "../../auth/keycloakOidc";
import { postAuthRedirectHref } from "../../lib/spaPath";

/**
 * Callback OIDC Keycloak: scambia code → id_token, poi POST /v1/auth/sso-exchange.
 */
export const KeycloakCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const [message, setMessage] = useState("Accesso SSO in corso…");

  useEffect(() => {
    if (!isKeycloakOidcConfigured()) {
      setMessage("Keycloak non è configurato (variabili VITE_KEYCLOAK_*).");
      return;
    }

    let cancelled = false;

    (async () => {
      const result = await exchangeKeycloakAuthorizationCode(searchParams);
      if (cancelled) return;
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      try {
        const tokens = await followupApi.ssoExchange(result.idToken);
        if (cancelled) return;
        setTokens(tokens.accessToken, tokens.refreshToken);
        window.sessionStorage.setItem("followup3.lastEmail", tokens.user.email);
        const backTo = consumeStoredOidcBackTo();
        window.location.replace(postAuthRedirectHref(backTo));
      } catch (e) {
        if (!cancelled) {
          setMessage(e instanceof Error ? e.message : "Accesso SSO non consentito.");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return (
    <div className="min-h-screen flex bg-auth-page items-center justify-center px-6">
      <p className="text-sm text-muted-foreground text-center max-w-md">{message}</p>
    </div>
  );
};
