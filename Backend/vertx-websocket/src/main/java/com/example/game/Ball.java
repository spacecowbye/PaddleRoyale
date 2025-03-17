package com.example.game;

import java.util.Random;


public class Ball {

    int radius = 10;
    int x = GameConstants.CANVAS_WIDTH/2;
    int y = GameConstants.CANVAS_HEIGHT/2;
    double dx;
    double dy;
    boolean paused = false;


    double getRandomSpeedX() {
        Random random  = new Random();
        double randomValue = random.nextDouble();
        boolean direction = randomValue > 0.5;
        if(!direction){
            return -1*(6 + randomValue * 4);
        }
        else{
            return (6 + randomValue * 4);
        }

    }
    double getRandomSpeedY(){
        Random random  = new Random();
        double randomValue = random.nextDouble();
        boolean direction = randomValue > 0.5;
        if(!direction){
            return -1*(randomValue* 1.95);
        }
        else{
            return 1*(randomValue * 1.95);
        }

    }
    Ball(){
        this.dx = getRandomSpeedX();
        this.dy = getRandomSpeedY();

    }

}
