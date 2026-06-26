# ── Stage 1: Build ─────────────────────────────────────────
# Build the Spring Boot app from the demo/ subdirectory
FROM maven:3.9.9-eclipse-temurin-17 AS build

WORKDIR /app

# Copy the backend source (demo/ subfolder contents)
COPY demo/pom.xml .
RUN mvn dependency:go-offline -q

COPY demo/src ./src
RUN mvn clean package -DskipTests -q

# ── Stage 2: Run ────────────────────────────────────────────
FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

# Security: run as non-root
RUN addgroup -S spring && adduser -S spring -G spring
USER spring:spring

COPY --from=build /app/target/*.jar app.jar

# Render injects PORT=10000 at runtime. Keep the same default locally so the
# image binds to the port Render health checks even if PORT is not present.
ENV PORT=10000
EXPOSE 10000

ENTRYPOINT ["sh", "-c", "exec java -Djava.security.egd=file:/dev/./urandom -Dserver.port=${PORT:-10000} -jar app.jar"]
