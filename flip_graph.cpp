/* Creates the flip graph (https://en.wikipedia.org/wiki/Flip_graph) for n points on a circle
   Prints the adjacency matrix of it, ready to be used on http://graphonline.ru/en/
*/
#include <bits/stdc++.h>
using namespace std;
typedef pair<int, int> pii;
#define i first
#define j second
#define pb push_back
int n;
vector<pii> d;
vector<vector<pii>> all;

vector<pii> cur;
void go(int i, int ct) {
	if(i == d.size()) {
		if(ct < n - 3) return;
		all.pb(cur);
		for(int j = 1; j < cur.size(); j++) assert(cur[j] > cur[j - 1]);
		return;
	}
	bool ok = true;
	for(pii p : cur)
		if(d[i].j <= p.i || d[i].i >= p.j || (d[i].i >= p.i && d[i].j <= p.j) || (p.i >= d[i].i && p.j <= d[i].j));
		else { ok = false; break; }
	if(ok) {
		cur.pb(d[i]);
		go(i + 1, ct + 1);
		cur.pop_back();
	}
	go(i + 1, ct);
}
const int N = 1123;
int adj[N][N];

void go(int u) {
	for(int k = 0; k < all[u].size(); k++) {
		pii ori = all[u][k];
		vector<pii> g = all[u];
		swap(g[k], g.back());
		g.pop_back();
		for(int i = 0; i < d.size(); i++) {
			if(d[i] == ori) continue;
			bool ok = true;
			for(pii p : g)
				if((d[i].j <= p.i || d[i].i >= p.j || (d[i].i >= p.i && d[i].j <= p.j) || (p.i >= d[i].i && p.j <= d[i].j)) && p != d[i]);
				else { ok = false; break; }
			if(ok) { g.pb(d[i]); break; }
		}
		sort(g.begin(), g.end());
		assert(g.size() == n - 3);
		int v = (lower_bound(all.begin(), all.end(), g) - all.begin());
		assert(v != all.size());
		adj[u][v] = 1;
	}
}

int main() {
	scanf("%d", &n);
	for(int i = 0; i < n; i++)
		for(int j = i + 2; j < n; j++)
			if(i != 0 || j != n - 1)
				d.pb(pii(i, j));
	go(0, 0);
	sort(all.begin(), all.end());
	for(int i = 0; i < all.size(); i++)
		go(i);
	for(int i = 0; i < all.size(); i++)
		for(int j = 0; j < all.size(); j++)
			printf("%d%c", adj[i][j], ",\n"[j == all.size() - 1]);
}
