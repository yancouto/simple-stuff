#include "graph.cpp"

// Start generating from this n
const int MIN_N = 6;

// m < 3n - 6
// connected
// deg(u) >= 4 => m >= 2n
struct generator {
  // std::ofstream out;
  int n;
  vector<int> cur_degrees;
  vector<vector<int>> adj;
  int count = 0;
  generator(int n_)
      : n(n_),
        // out("generated/n_" + std::to_string(n) + ".txt"),
        adj(n),
        cur_degrees(n, 0) {}
  void gen(int u, int m_left) {
    int max_degree_allowed = u == 0 ? n - 2 : cur_degrees[u - 1];
    // if degs are the same, we want to prevent as much as possible vertices to
    // be permutated.
    if (u > 1 && cur_degrees[u - 1] == cur_degrees[u - 2])
      if (adj[u - 2] < adj[u - 1]) return;
    if (max_degree_allowed < 4) return;  // previous guy had less than 4 edges
    if (u == n) {
      count++;
      return;
    }
    if (cur_degrees[u] > max_degree_allowed || cur_degrees[u] + m_left < 4)
      return;
    int min_edges_left = 0;
    for (int v = u; v < n; v++) {
      min_edges_left += 4 - std::min(cur_degrees[v], 4);
      if (cur_degrees[v] > max_degree_allowed) return;
    }
    if (min_edges_left / 2 > m_left) return;
    rec_ar(u, u + 1, std::min(max_degree_allowed - cur_degrees[u], m_left),
           m_left);
  }
  void rec_ar(int u, int v, int mx_ar_u, int m_left) {
    if (v == n) return gen(u + 1, m_left);
    if (mx_ar_u > 0 && cur_degrees[v] < cur_degrees[u] + mx_ar_u) {
      cur_degrees[u]++;
      cur_degrees[v]++;
      adj[u].push_back(v);
      adj[v].push_back(u);
      rec_ar(u, v + 1, mx_ar_u - 1, m_left - 1);
      adj[u].pop_back();
      adj[v].pop_back();
      cur_degrees[u]--;
      cur_degrees[v]--;
    }
    rec_ar(u, v + 1, mx_ar_u, m_left);
  }
};

int main() {
  for (int n = MIN_N;; n++) {
    generator g(n);
    g.gen(0, 3 * n - 7);
    printf("Done for n = %d, generated %d graphs.\n", n, g.count);
  }
}