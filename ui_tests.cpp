// Exercise the same drawing, click handlers and timer handler as the desktop app.
// A message-only window keeps this verification entirely in the background.
#define wWinMain kaooaDesktopEntry
#include "main.cpp"
#undef wWinMain
int main(){
    GdiplusStartupInput input;ULONG_PTR token;GdiplusStartup(&token,&input,nullptr);
    window=CreateWindowEx(0,L"STATIC",L"Kaooa test harness",0,0,0,0,0,HWND_MESSAGE,nullptr,GetModuleHandle(nullptr),nullptr);
    std::ofstream report("ui-test-results.txt");
    try{
        Bitmap buffer(1080,720);Graphics graphics(&buffer);
        mode=0;reset();draw(graphics);auto p=location(0);click(p.X,p.Y);
        require(state.placed==1 && state.turn==2,"mouse placement");
        proc(window,WM_TIMER,1,0);require(state.turn==1,"computer responds");
        draw(graphics);click(750,585);require(state.placed==0 && history.empty(),"undo human plus computer turn");
        draw(graphics);click(900,130);require(!strategic,"difficulty toggle");
        draw(graphics);click(750,635);require(rules,"rules open");
        draw(graphics);click(250,615);require(!rules,"rules close");
        draw(graphics);click(750,130);require(mode==1 && aiTurn(),"human vulture mode");
        proc(window,WM_TIMER,1,0);require(state.placed==1 && state.turn==2,"computer crows opening");
        draw(graphics);click(750,130);require(mode==2 && !aiTurn(),"two player mode");
        draw(graphics);click(900,585);require(!hints,"hints toggle");
        draw(graphics);click(750,490);require(state.placed==0 && history.empty(),"new game reset");
        report<<"PASS: mouse placement, computer response, undo pair, difficulty switch, rules open/close, human vulture mode, computer crows, local mode, hints, new game.\n";
    }catch(const std::exception& e){report<<"FAIL: "<<e.what()<<'\n';DestroyWindow(window);GdiplusShutdown(token);return 1;}
    DestroyWindow(window);GdiplusShutdown(token);return 0;
}
