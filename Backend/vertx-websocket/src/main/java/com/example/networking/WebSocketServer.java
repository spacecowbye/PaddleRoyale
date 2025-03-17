package com.example.networking;

import io.vertx.core.AbstractVerticle;
import io.vertx.core.Vertx;
import io.vertx.core.http.HttpServer;
import io.vertx.core.http.ServerWebSocket;

public class WebSocketServer extends AbstractVerticle {
    @Override
    public void start() {
        HttpServer server = vertx.createHttpServer();

        server.webSocketHandler(this::handleWebSocket);

        server.listen(8080, res -> {
            if (res.succeeded()) {
                System.out.println("WebSocket server started on port 8080");
            } else {
                System.err.println("Failed to start WebSocket server: " + res.cause().getMessage());
            }
        });
    }

    private void handleWebSocket(ServerWebSocket webSocket) {
        System.out.println("New WebSocket connection: " + webSocket.path());

        webSocket.textMessageHandler(message -> {
            System.out.println("Received: " + message);
            webSocket.writeTextMessage("Echo: " + message);
        });

        webSocket.closeHandler(v  -> System.out.println("WebSocket closed"));
    }

    public static void main(String[] args) {
        Vertx vertx = Vertx.vertx();
        vertx.deployVerticle(new WebSocketServer());
    }
}
