#include <cstdio>
#include <ctime>
#include <ranges>

// Fuck it, include cpp
#include "graph.cpp"

using namespace std::ranges;
typedef std::pair<int, int> edge;

graph create_counter() {
  graph g;
  g.adj.resize(28);
  vector<edge> k4_edges;
  for (int i = 0; i < 4; i++)
    for (int j = i + 1; j < 4; j++) k4_edges.emplace_back(i, j);
  for (int i = 0; i < 7; i++) {
    for (int j = 0; j < 6; j++)
      g.add_edge(i * 4 + k4_edges[j].first, i * 4 + k4_edges[j].second);
    for (int j = i + 1; j < 7; j++) {
      auto [di1, di2] = k4_edges[j - 1];
      auto [dj1, dj2] = k4_edges[i];
      g.add_edge(i * 4 + di1, j * 4 + dj1);
      g.add_edge(i * 4 + di2, j * 4 + dj2);
    }
  }
  for (int i = 0; i < 28; i++) std::ranges::sort(g.adj[i]);
  g.validate();
  return g;
}

int main() {
  printf("Starting.\n");
  srand(time(NULL));
  graph g = create_counter();
  auto cut = g.forest_cut();
  if (cut.empty())
    printf("No forest cut\n");
  else {
    assert(g.is_forest_cut(cut));
    printf("Cut:");
    for (int v : cut) printf(" %d", v + 1);
    putchar('\n');
    g.print_debug();
  }
}