#include <cstdio>
#include <ctime>

// Fuck it, include cpp
#include "graph.cpp"

typedef std::pair<int, int> edge;

const bool READ_SINGLE_INPUT = true;

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
  for (int i = 0; i < 28; i++) std::sort(g.adj[i].begin(), g.adj[i].end());
  g.validate();
  return g;
}

vector<graph> get_graphs() {
  if (READ_SINGLE_INPUT)
    return graph::from_file(std::cin, Format::EDGES);
  else
    return {create_counter()};
}

int main() {
  printf("Starting.\n");
  srand(time(NULL));
  auto graphs = get_graphs();
  for (graph g : graphs) {
    auto cut = g.forest_cut();
    if (cut.empty())
      printf("No forest cut\n");
    else {
      assert(g.is_forest_cut(cut));
      printf("Cut:");
      for (int v : cut) printf(" %d", g.user_friendly(v));
      putchar('\n');
      g.print_debug();
    }
  }
}