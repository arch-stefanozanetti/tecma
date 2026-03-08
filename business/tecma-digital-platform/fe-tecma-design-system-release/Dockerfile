
ARG OCIR_CI_REGISTRY
ARG OCIR_CI_NAMESPACE
FROM ${OCIR_CI_REGISTRY}/${OCIR_CI_NAMESPACE}/dev/node:18.20-buster AS build

COPY ./ /app/
WORKDIR /app/

RUN yarn install --pure-lockfile
RUN yarn build-storybook

FROM ${OCIR_CI_REGISTRY}/${OCIR_CI_NAMESPACE}/dev/nginx:stable AS deploy

COPY --from=build /app/storybook-static /usr/share/nginx/html
RUN rm /etc/nginx/conf.d/default.conf
COPY nginx/nginx.conf /etc/nginx/conf.d
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
