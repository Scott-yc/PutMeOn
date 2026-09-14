FROM node:22-alpine AS frontend
WORKDIR /frontend
COPY frontend/putmeon-web/package*.json ./
RUN npm ci
COPY frontend/putmeon-web/ ./
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY backend/PutMeOn.Api/PutMeOn.Api.csproj backend/PutMeOn.Api/packages.lock.json backend/PutMeOn.Api/
COPY shared/ shared/
RUN dotnet restore backend/PutMeOn.Api/PutMeOn.Api.csproj --locked-mode
COPY backend/PutMeOn.Api/ backend/PutMeOn.Api/
RUN dotnet publish backend/PutMeOn.Api/PutMeOn.Api.csproj -c Release --no-restore -o /out
COPY --from=frontend /frontend/dist/ /out/wwwroot/

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
# Npgsql can probe GSSAPI when connecting to PostgreSQL on Linux.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgssapi-krb5-2 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /out/ ./
ENV ASPNETCORE_URLS=http://0.0.0.0:8080
ENV ASPNETCORE_ENVIRONMENT=Production
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "PutMeOn.Api.dll"]
