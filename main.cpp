#define NOMINMAX
#include <windows.h>
#include <windowsx.h>
#include <gdiplus.h>
#include <string>
#include <fstream>
#include <random>
#include <stdexcept>
#include <filesystem>
#include <sstream>
#include "game.h"
#include "save.h"
using namespace Gdiplus;
using namespace kaooa;
namespace {
Game game;
State state;
std::vector<State> history;
int selected=-1,mode=0,hover=-1; // 0 human crows, 1 human vulture, 2 local players
bool strategic=true;
std::mt19937 aiRandom(std::random_device{}());
bool rules=false,hints=true,thinking=false;
HWND window=nullptr;
float scale=1,ox=0,oy=0;
std::wstring note=L"Choose an empty point to place your first crow.";
Color bg(255,16,27,29),panel(255,23,39,41),gold(255,226,180,102),cream(255,239,234,217),muted(255,151,170,165),teal(255,96,202,180);
struct Button {RectF rect;std::wstring label;int id;};
std::vector<Button> buttons;
bool aiTurn(){return mode!=2 && state.turn==(mode==0?2:1) && !state.winner;}
PointF location(int i){return PointF(362+(float)game.points[i].x*249,384+(float)game.points[i].y*249);}
void text(Graphics& g,const std::wstring& s,float x,float y,float w,float h,float size,Color c,bool bold=false,const wchar_t* face=L"Segoe UI") {
    Font font(face,size,bold?FontStyleBold:FontStyleRegular,UnitPixel);SolidBrush b(c);
    StringFormat f;f.SetFormatFlags(StringFormatFlagsNoClip);g.DrawString(s.c_str(),-1,&font,RectF(x,y,w,h),&f,&b);
}
void round(Graphics& g,RectF r,float rad,Color fill,Color stroke=Color(0,0,0,0)) {
    GraphicsPath p;float d=rad*2;
    p.AddArc(r.X,r.Y,d,d,180,90);p.AddArc(r.GetRight()-d,r.Y,d,d,270,90);
    p.AddArc(r.GetRight()-d,r.GetBottom()-d,d,d,0,90);p.AddArc(r.X,r.GetBottom()-d,d,d,90,90);p.CloseFigure();
    SolidBrush b(fill);g.FillPath(&b,&p);if(stroke.GetA()){Pen pen(stroke);g.DrawPath(&pen,&p);}
}
void circle(Graphics& g,float x,float y,float r,Color c){SolidBrush b(c);g.FillEllipse(&b,x-r,y-r,r*2,r*2);}
void bird(Graphics& g,float x,float y,bool v,float size=1) {
    GraphicsState saved=g.Save();g.TranslateTransform(x,y);g.ScaleTransform(size,size);
    Color ink=v?Color(255,51,39,24):Color(255,12,45,42);
    SolidBrush b(ink);PointF wing[]={{-16,4},{-23,-8},{-7,-3},{-2,-12},{8,-13},{13,-7},{20,-3},{12,0},{8,11},{-3,12},{-9,5}};
    g.FillPolygon(&b,wing,11);circle(g,5,-8,1.7f,v?cream:teal);g.Restore(saved);
}
void button(Graphics& g,RectF r,std::wstring label,int id,bool primary=false) {
    buttons.push_back({r,label,id});Color f=primary?gold:Color(255,34,53,54);
    if(hover==id) f=primary?Color(255,243,202,132):Color(255,48,74,73);
    round(g,r,9,f);text(g,label,r.X+14,r.Y+10,r.Width-22,r.Height-12,14,primary?bg:cream,true);
}
void draw(Graphics& g) {
    g.SetSmoothingMode(SmoothingModeAntiAlias);g.SetTextRenderingHint(TextRenderingHintAntiAliasGridFit);
    g.Clear(bg);buttons.clear();
    text(g,L"THE HERITAGE COLLECTION     /     01",40,25,600,25,11,gold,true);
    text(g,L"KAOOA",37,49,510,67,49,cream,true,L"Georgia");
    text(g,L"V U L T U R E   &   C R O W S",41,113,590,28,12,muted);
    text(g,L"A traditional Indian game of pursuit and patience.",40,684,670,26,12,muted);
    text(g,L"C++  /  DESKTOP  /  v1.2.1",790,686,275,22,10,gold,true);
    // Restrained concentric engraving and a five-point star on a dark stone board.
    Pen ring(Color(255,36,54,54),1);
    for(int r=220;r<=286;r+=22) g.DrawEllipse(&ring,362.f-r,384.f-r,r*2.f,r*2.f);
    for(int i=0;i<60;++i){double a=i*3.141592653589793/30;Pen tick(Color(255,56,70,65),1);float r=i%5==0?281.f:286.f;g.DrawLine(&tick,362+(float)cos(a)*r,384+(float)sin(a)*r,362+(float)cos(a)*290,384+(float)sin(a)*290);}
    for(int i=0;i<5;++i){PointF a=location(i),b=location((i+2)%5);Pen shadow(Color(255,8,19,21),9);g.DrawLine(&shadow,a,b);Pen edge(Color(255,131,115,81),3);g.DrawLine(&edge,a,b);Pen light(Color(255,190,157,103),1);g.DrawLine(&light,a,b);}
    auto legal=game.moves(state);
    for(int i=0;i<10;++i) {
        PointF p=location(i);bool target=false;
        for(auto m:legal) if(m.to==i && (m.from==-1 || m.from==selected)) target=true;
        circle(g,p.X,p.Y+3,21,Color(255,8,20,21));circle(g,p.X,p.Y,18,Color(255,59,72,64));circle(g,p.X,p.Y,14,Color(255,21,36,37));
        if(!state.board[i] && hints && target && !aiTurn() && !state.winner){circle(g,p.X,p.Y,6,teal);}
        if(state.board[i]) {
            bool v=state.board[i]==2;
            if(selected==i){Pen sel(cream,2);g.DrawEllipse(&sel,p.X-28,p.Y-28,56.f,56.f);}
            circle(g,p.X,p.Y+4,23,Color(255,6,18,20));
            LinearGradientBrush fill(PointF(p.X-20,p.Y-23),PointF(p.X+18,p.Y+23),v?Color(255,250,216,151):Color(255,143,223,200),v?Color(255,192,139,65):Color(255,58,150,134));
            g.FillEllipse(&fill,p.X-23,p.Y-23,46.f,46.f);bird(g,p.X,p.Y,v);
        }
        text(g,std::to_wstring(i+1),p.X+24,p.Y-23,26,18,10,muted);
    }
    round(g,RectF(706,30,334,640),18,panel,Color(255,43,61,61));
    text(g,L"THE TABLE",730,51,285,25,11,gold,true);
    const wchar_t* modes[]={L"You: crows  /  Computer: vulture",L"You: vulture  /  Computer: crows",L"Two players  /  Pass & play"};
    text(g,modes[mode],730,78,290,25,13,cream);
    button(g,RectF(730,112,136,39),L"Change mode",1);
    button(g,RectF(878,112,138,39),strategic?L"AI: strategic":L"AI: easy",7);
    std::wstring title=state.winner?(state.winner==3?L"A balanced contest":state.winner==1?L"The crows win!":L"The vulture wins!"):(aiTurn()?L"Computer is thinking...":state.turn==1?L"The crows' turn":L"The vulture's turn");
    text(g,title,730,176,293,38,23,cream,true);
    std::wstring phase=state.winner?L"Start a new game or undo a move.":state.turn==1?(state.placed<7?L"PLACE  /  Build your blockade":L"MOVE  /  Close the escape routes"):L"HUNT  /  Capture four crows";
    text(g,phase,730,218,289,28,12,state.turn==1?teal:gold,true);
    text(g,note,730,256,281,76,15,muted);
    text(g,L"CROWS PLACED",730,344,160,20,10,muted,true);
    text(g,std::to_wstring(state.placed)+L" / 7",920,335,99,36,25,cream,true);
    for(int i=0;i<7;++i) circle(g,741.f+i*22,378,5,i<state.placed?teal:Color(255,48,68,66));
    text(g,L"CROWS CAPTURED",730,411,177,20,10,muted,true);
    text(g,std::to_wstring(state.captured)+L" / 4",920,402,99,36,25,gold,true);
    for(int i=0;i<4;++i) circle(g,741.f+i*22,445,5,i<state.captured?gold:Color(255,48,68,66));
    button(g,RectF(730,475,286,42),L"New game",2,true);
    button(g,RectF(730,527,136,36),L"Save game",8);
    button(g,RectF(878,527,138,36),L"Load game",9);
    button(g,RectF(730,573,136,36),L"Undo",3);
    button(g,RectF(878,573,138,36),hints?L"Hints: on":L"Hints: off",4);
    button(g,RectF(730,619,286,36),L"How to play & history",5);
    if(rules){
        SolidBrush shade(Color(225,7,17,19));g.FillRectangle(&shade,0,0,1080,720);
        round(g,RectF(190,55,700,608),20,panel,Color(255,97,100,76));
        text(g,L"A star. Eight birds. Two strategies.",224,82,625,54,29,cream,true,L"Georgia");
        text(g,L"HOW TO PLAY KAOOA",225,142,625,25,11,gold,true);
        text(g,L"01   Place your flock",225,183,615,30,19,teal,true);
        text(g,L"Crows start. Place one crow on an empty point. The vulture then enters. Alternate turns; place all seven crows before moving them.",225,217,620,61,16,cream);
        text(g,L"02   Follow the star",225,291,615,30,19,teal,true);
        text(g,L"Move to a connected empty point. The vulture must jump an adjacent crow when possible, landing on the next empty point in the same straight line. One capture per turn; crows cannot jump.",225,325,620,88,16,cream);
        text(g,L"03   Trap or capture",225,422,615,30,19,teal,true);
        text(g,L"Crows win by leaving the vulture no legal move. The vulture wins by capturing four crows. Three repetitions of a position produce a draw in this edition.",225,455,620,69,16,cream);
        text(g,L"A traditional hunt game recorded in India. Its precise origin date is uncertain. See README.md for historical context and rule sources.",225,535,620,49,12,muted);
        button(g,RectF(225,600,620,40),L"Back to the board",6,true);
    }
}
void refresh(){InvalidateRect(window,nullptr,FALSE);}
void schedule(){thinking=aiTurn();if(thinking)SetTimer(window,1,450,nullptr);}
void reset(){KillTimer(window,1);state={};history.clear();selected=-1;note=L"Choose an empty point to place a crow.";schedule();refresh();}
std::filesystem::path savePath(){wchar_t path[32768];GetModuleFileName(nullptr,path,32768);return std::filesystem::path(path).parent_path()/L"Kaooa-save.txt";}
void saveMatch(){
    auto path=savePath(),temporary=path;temporary+=L".tmp";
    std::ofstream out(temporary);bool ok=writeSave(out,state,history,mode);out.close();ok=ok&&!out.fail();
    if(ok)ok=MoveFileEx(temporary.c_str(),path.c_str(),MOVEFILE_REPLACE_EXISTING|MOVEFILE_WRITE_THROUGH)!=0;
    note=ok?L"Saved beside the executable. Load it whenever you return.":L"Could not save. Move the game to a writable folder and try again.";
}
void loadMatch(){
    std::ifstream in(savePath());State restored;std::vector<State> past;int restoredMode;
    if(!readSave(in,game,restored,past,restoredMode)){note=L"No valid saved game found. Your current game is unchanged.";return;}
    KillTimer(window,1);state=restored;history=past;mode=restoredMode;selected=-1;note=L"Saved game restored, including undo history.";schedule();
}
void play(Move m){
    history.push_back(state);state=game.apply(state,m);selected=-1;
    int repeats=1;for(const auto& s:history)if(game.key(s)==game.key(state))++repeats;
    if(!state.winner && repeats>=3)state.winner=3;
    note=state.winner?(state.winner==1?L"The flock has sealed every escape route.":state.winner==2?L"Four crows captured. The hunter prevails.":L"This position has repeated or no move remains."):
        m.over>=0?L"A crow was captured. Plan your next move.":state.turn==1?(state.placed<7?L"Place a crow on any empty point.":L"Select a crow, then a highlighted destination."):L"Select the vulture, then a destination. Available captures are compulsory.";
    if(state.turn==2 && !state.winner)for(int i=0;i<10;++i)if(state.board[i]==2)selected=i;
    schedule();refresh();
}
void click(float x,float y){
    for(auto it=buttons.rbegin();it!=buttons.rend();++it)if(it->rect.Contains(x,y)){
        int id=it->id;if(rules && id!=6)return;
        if(id==1){mode=(mode+1)%3;reset();}
        if(id==2)reset();
        if(id==3 && !history.empty()){
            KillTimer(window,1);state=history.back();history.pop_back();
            if(mode!=2 && aiTurn() && !history.empty()){state=history.back();history.pop_back();}
            selected=-1;note=L"Move undone. Choose your next move.";schedule();
        }
        if(id==4)hints=!hints;
        if(id==5)rules=true;
        if(id==6){rules=false;schedule();}
        if(id==7){strategic=!strategic;note=strategic?L"Strategic AI plans five moves ahead.":L"Easy AI chooses a random legal move.";}
        if(id==8)saveMatch();
        if(id==9)loadMatch();
        refresh();return;
    }
    if(rules || aiTurn() || state.winner)return;
    int hit=-1;for(int i=0;i<10;++i){auto p=location(i);if(std::hypot(x-p.X,y-p.Y)<28)hit=i;}
    if(hit<0)return;
    for(auto m:game.moves(state))if(m.to==hit && (m.from==-1 || m.from==selected)){play(m);return;}
    if(state.board[hit]==state.turn){selected=hit;note=L"Choose a highlighted point connected to this bird.";}
    else note=L"That point is not a legal destination. Follow the star's lines.";
    refresh();
}
LRESULT CALLBACK proc(HWND h,UINT msg,WPARAM wp,LPARAM lp){
    switch(msg){
    case WM_ERASEBKGND:return 1;
    case WM_GETMINMAXINFO:{auto p=reinterpret_cast<MINMAXINFO*>(lp);p->ptMinTrackSize={820,580};return 0;}
    case WM_SIZE:refresh();return 0;
    case WM_PAINT:{PAINTSTRUCT ps;HDC dc=BeginPaint(h,&ps);RECT r;GetClientRect(h,&r);int w=r.right,ht=r.bottom;if(w>0 && ht>0){Bitmap bmp(w,ht,PixelFormat32bppARGB);Graphics g(&bmp);g.Clear(bg);scale=std::min(w/1080.f,ht/720.f);ox=(w-1080*scale)/2;oy=(ht-720*scale)/2;g.TranslateTransform(ox,oy);g.ScaleTransform(scale,scale);draw(g);Graphics out(dc);out.SetPageUnit(UnitPixel);out.DrawImage(&bmp,Rect(0,0,w,ht),0,0,w,ht,UnitPixel);}EndPaint(h,&ps);return 0;}
    case WM_LBUTTONDOWN:click((GET_X_LPARAM(lp)-ox)/scale,(GET_Y_LPARAM(lp)-oy)/scale);return 0;
    case WM_MOUSEMOVE:{float x=(GET_X_LPARAM(lp)-ox)/scale,y=(GET_Y_LPARAM(lp)-oy)/scale;int next=-1;for(auto b:buttons)if(b.rect.Contains(x,y))next=b.id;if(hover!=next){hover=next;refresh();}SetCursor(LoadCursor(nullptr,next>=0?IDC_HAND:IDC_ARROW));return 0;}
    case WM_TIMER:if(wp==1){KillTimer(h,1);if(rules)return 0;if(aiTurn()){auto ms=game.moves(state);auto m=strategic?game.choose(state):ms[aiRandom()%ms.size()];play(m);}thinking=false;}return 0;
    case WM_KEYDOWN:if(wp==VK_ESCAPE){rules=false;schedule();refresh();}if(wp=='H'){rules=!rules;if(!rules)schedule();refresh();}return 0;
    case WM_DESTROY:KillTimer(h,1);PostQuitMessage(0);return 0;
    }return DefWindowProc(h,msg,wp,lp);
}
void require(bool v,const char* message){if(!v)throw std::runtime_error(message);}
int tests(){
    std::ofstream report("test-results.txt");
    try{
        require(game.points.size()==10,"ten board points");int edges=0;
        for(int i=0;i<10;++i)for(int j=i+1;j<10;++j)if(game.adjacent[i][j])++edges;
        require(edges==15,"fifteen board edges");for(auto l:game.lines)require(l.size()==4,"four points on every straight line");
        State s;require(game.moves(s).size()==10,"opening placements");s=game.apply(s,{-1,0});require(s.placed==1 && s.turn==2,"crow opening");require(game.moves(s).size()==9,"vulture placement");
        auto l=game.lines[0];s={};s.turn=2;s.placed=7;s.board[l[0]]=2;s.board[l[1]]=1;
        auto ms=game.moves(s);require(ms.size()==1 && ms[0].over==l[1] && ms[0].to==l[2],"mandatory straight capture");
        s.captured=3;s=game.apply(s,ms[0]);require(s.winner==2 && s.captured==4 && !s.board[l[1]],"four captures win");
        s={};s.turn=2;s.board[0]=2;for(int i=1;i<10;++i)s.board[i]=1;require(game.moves(s).empty(),"surrounded vulture cannot move");
        bool trapFound=false;for(int mask=0;mask<1024;++mask){State t;t.turn=1;t.placed=6;t.board[0]=2;int count=0;for(int i=1;i<10;++i)if(mask&(1<<i)){t.board[i]=1;++count;}if(count!=6)continue;for(auto m:game.moves(t))if(game.apply(t,m).winner==1)trapFound=true;}require(trapFound,"crow placement can win by trapping");
        std::mt19937 random(42);int turns=0;
        for(int run=0;run<500;++run){s={};for(int n=0;n<180 && !s.winner;++n){ms=game.moves(s);require(!ms.empty(),"ongoing game has moves");auto m=ms[random()%ms.size()];require(!s.board[m.to],"destination empty");s=game.apply(s,m);int c=0,v=0;for(int b:s.board){c+=b==1;v+=b==2;}require(c+s.captured==s.placed && s.placed<=7 && v<=1,"piece conservation");++turns;}}
        s={};for(int n=0;n<70 && !s.winner;++n){Move m=game.choose(s);ms=game.moves(s);require(std::any_of(ms.begin(),ms.end(),[&](Move x){return x.from==m.from&&x.to==m.to&&x.over==m.over;}),"AI move legal");s=game.apply(s,m);}
        State current;std::vector<State> past;for(int i=0;i<8 && !current.winner;++i){past.push_back(current);current=game.apply(current,game.moves(current).front());}
        std::stringstream saved;require(writeSave(saved,current,past,2),"save writes");State loaded;std::vector<State> loadedPast;int loadedMode=-1;
        require(readSave(saved,game,loaded,loadedPast,loadedMode) && game.key(loaded)==game.key(current) && loadedPast.size()==past.size() && loadedMode==2,"save round trip");
        std::stringstream bad("KAOOA_SAVE_1 0 1\n1 0 0 0 2 0 0 0 0 0 0 0 0 0\n");require(!readSave(bad,game,loaded,loadedPast,loadedMode),"reject impossible saves");
        report<<"PASS: geometry, placement, mandatory capture, capture victory, trapping victory, piece conservation, AI legality, save round trip, invalid save rejection.\n500 seeded games; "<<turns<<" simulated turns.\n";return 0;
    }catch(const std::exception& e){report<<"FAIL: "<<e.what()<<'\n';return 1;}
}
void snapshot(bool help){
    state=game.apply(State{}, {-1,0});state=game.apply(state,{-1,2});state=game.apply(state,{-1,4});selected=2;mode=2;rules=help;note=L"Select the vulture, then a highlighted destination.";
    Bitmap bmp(1080,720,PixelFormat32bppARGB);{Graphics g(&bmp);draw(g);}
    UINT n=0,bytes=0;GetImageEncodersSize(&n,&bytes);std::vector<BYTE> memory(bytes);auto enc=reinterpret_cast<ImageCodecInfo*>(memory.data());GetImageEncoders(n,bytes,enc);
    for(UINT i=0;i<n;++i)if(wcscmp(enc[i].MimeType,L"image/png")==0)bmp.Save(help?L"rules-preview.png":L"preview.png",&enc[i].Clsid,nullptr);
}
}
int WINAPI wWinMain(HINSTANCE instance,HINSTANCE,PWSTR command,int show){
    if(wcsstr(command,L"--test"))return tests();
    GdiplusStartupInput input;ULONG_PTR token; if(GdiplusStartup(&token,&input,nullptr)!=Ok)return 1;
    if(wcsstr(command,L"--snapshot")){snapshot(wcsstr(command,L"rules")!=nullptr);GdiplusShutdown(token);return 0;}
    SetProcessDPIAware();WNDCLASS wc{};wc.lpfnWndProc=proc;wc.hInstance=instance;wc.lpszClassName=L"KaooaDesktop";wc.hCursor=LoadCursor(nullptr,IDC_ARROW);wc.hIcon=LoadIcon(nullptr,IDI_APPLICATION);RegisterClass(&wc);
    RECT r{0,0,1080,720};AdjustWindowRect(&r,WS_OVERLAPPEDWINDOW,FALSE);
    window=CreateWindow(wc.lpszClassName,L"Kaooa | Vulture & Crows",WS_OVERLAPPEDWINDOW,CW_USEDEFAULT,CW_USEDEFAULT,r.right-r.left,r.bottom-r.top,nullptr,nullptr,instance,nullptr);
    if(!window){GdiplusShutdown(token);return 1;}ShowWindow(window,show);UpdateWindow(window);
    MSG msg;while(GetMessage(&msg,nullptr,0,0)>0){TranslateMessage(&msg);DispatchMessage(&msg);}GdiplusShutdown(token);return 0;
}
