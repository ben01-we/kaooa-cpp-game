#pragma once
#include "game.h"
#include <istream>
#include <ostream>

namespace kaooa {
// Save complete history so undo and repetition detection survive a restart.
inline bool writeSave(std::ostream& out,const State& current,const std::vector<State>& history,int mode) {
    out<<"KAOOA_SAVE_1 "<<mode<<' '<<history.size()+1<<'\n';
    auto write=[&](const State& s){out<<s.turn<<' '<<s.placed<<' '<<s.captured<<' '<<s.winner;for(int b:s.board)out<<' '<<b;out<<'\n';};
    for(const auto& s:history)write(s);write(current);return out.good();
}
inline bool readSave(std::istream& in,const Game& game,State& current,std::vector<State>& history,int& mode) {
    std::string signature;int loadedMode,count;
    if(!(in>>signature>>loadedMode>>count) || signature!="KAOOA_SAVE_1" || loadedMode<0 || loadedMode>2 || count<1 || count>10000)return false;
    std::vector<State> states;
    for(int n=0;n<count;++n){State s;if(!(in>>s.turn>>s.placed>>s.captured>>s.winner))return false;
        for(int& b:s.board)if(!(in>>b) || b<0 || b>2)return false;
        if(s.turn<1 || s.turn>2 || s.placed<0 || s.placed>7 || s.captured<0 || s.captured>4 || s.winner<0 || s.winner>3)return false;
        if(n==0){if(game.key(s)!=game.key(State{}) || s.winner)return false;}
        else {bool valid=false;for(auto m:game.moves(states.back())){auto next=game.apply(states.back(),m);
            int repeats=1;for(const auto& prior:states)if(game.key(prior)==game.key(next))++repeats;
            if(!next.winner && repeats>=3)next.winner=3;
            if(game.key(next)==game.key(s) && next.winner==s.winner){valid=true;break;}}
            if(!valid)return false;
        }states.push_back(s);
    }
    std::string extra;if(in>>extra)return false;
    current=states.back();states.pop_back();history=states;mode=loadedMode;return true;
}
}
