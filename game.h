#pragma once
#include <array>
#include <vector>
#include <algorithm>
#include <cmath>
#include <cstdint>

namespace kaooa {
struct Point { double x, y; };
struct Move { int from, to, over = -1; };
struct State {
    std::array<int,10> board{}; // 0 empty, 1 crow, 2 vulture
    int turn = 1, placed = 0, captured = 0, winner = 0;
};
class Game {
public:
    std::vector<Point> points;
    std::vector<std::vector<int>> lines;
    bool adjacent[10][10]{};
    Game() {
        constexpr double pi = 3.141592653589793;
        for (int i=0;i<5;++i) points.push_back({std::cos(-pi/2+i*2*pi/5),std::sin(-pi/2+i*2*pi/5)});
        auto cross=[](Point a,Point b){return a.x*b.y-a.y*b.x;};
        auto sub=[](Point a,Point b){return Point{a.x-b.x,a.y-b.y};};
        for(int i=0;i<5;++i) for(int j=i+1;j<5;++j) {
            Point a=points[i],b=points[(i+2)%5],c=points[j],d=points[(j+2)%5];
            Point r=sub(b,a),s=sub(d,c); double den=cross(r,s);
            if(std::abs(den)<1e-8) continue;
            double t=cross(sub(c,a),s)/den,u=cross(sub(c,a),r)/den;
            if(t>1e-6 && t<1-1e-6 && u>1e-6 && u<1-1e-6) points.push_back({a.x+t*r.x,a.y+t*r.y});
        }
        for(int i=0;i<5;++i) {
            Point a=points[i],r=sub(points[(i+2)%5],a);
            std::vector<std::pair<double,int>> ordered;
            for(int n=0;n<10;++n) if(std::abs(cross(sub(points[n],a),r))<1e-6)
                ordered.push_back({(points[n].x-a.x)*r.x+(points[n].y-a.y)*r.y,n});
            std::sort(ordered.begin(),ordered.end()); std::vector<int> line;
            for(auto p:ordered) line.push_back(p.second);
            for(size_t n=1;n<line.size();++n) adjacent[line[n-1]][line[n]]=adjacent[line[n]][line[n-1]]=true;
            lines.push_back(line);
        }
    }
    std::vector<Move> moves(const State& s) const {
        std::vector<Move> out,jumps;
        if(s.winner) return out;
        int v=-1; for(int i=0;i<10;++i) if(s.board[i]==2) v=i;
        if((s.turn==1 && s.placed<7) || (s.turn==2 && v<0)) {
            for(int i=0;i<10;++i) if(!s.board[i]) out.push_back({-1,i});
            return out;
        }
        for(int i=0;i<10;++i) if(s.board[i]==s.turn)
            for(int j=0;j<10;++j) if(!s.board[j] && adjacent[i][j]) out.push_back({i,j});
        if(s.turn==2) {
            for(const auto& l:lines) for(int i=0;i+2<(int)l.size();++i) {
                int a=l[i],b=l[i+1],c=l[i+2];
                if(s.board[b]!=1) continue;
                if(a==v && !s.board[c]) jumps.push_back({a,c,b});
                if(c==v && !s.board[a]) jumps.push_back({c,a,b});
            }
        }
        // This edition uses mandatory captures, one straight-line jump per turn.
        return jumps.empty()?out:jumps;
    }
    State apply(State s, Move m) const {
        if(m.from>=0) s.board[m.from]=0;
        else if(s.turn==1) ++s.placed;
        s.board[m.to]=s.turn;
        if(m.over>=0) {s.board[m.over]=0;++s.captured;}
        s.turn=3-s.turn;
        if(s.captured>=4) s.winner=2;
        else {
            State v=s;v.turn=2;
            if(moves(v).empty()) s.winner=1;
            else if(moves(s).empty()) s.winner=3; // no move available: draw
        }
        return s;
    }
    uint64_t key(const State& s) const {
        uint64_t k=s.turn+3*s.placed+24*s.captured;
        for(int b:s.board) k=k*3+b;
        return k;
    }
    int evaluate(const State& s) const {
        if(s.winner) return s.winner==2?10000:(s.winner==1?-10000:0);
        State v=s;v.turn=2; auto ms=moves(v);
        int freedom=0;for(auto m:ms) freedom+=m.over>=0?3:1;
        return s.captured*150+freedom*12;
    }
    int search(const State& s,int depth,int alpha,int beta) const {
        if(depth==0 || s.winner) return evaluate(s);
        auto ms=moves(s);if(ms.empty()) return 0;
        int best=s.turn==2?-20000:20000;
        for(auto m:ms) {
            int score=search(apply(s,m),depth-1,alpha,beta);
            if(s.turn==2){best=std::max(best,score);alpha=std::max(alpha,best);}
            else {best=std::min(best,score);beta=std::min(beta,best);}
            if(beta<=alpha) break;
        }
        return best;
    }
    Move choose(const State& s) const {
        auto ms=moves(s); Move best=ms.front();int score=s.turn==2?-20001:20001;
        for(auto m:ms) {
            int val=search(apply(s,m),4,-20000,20000);
            if((s.turn==2 && val>score)||(s.turn==1 && val<score)) {score=val;best=m;}
        }
        return best;
    }
};
}
