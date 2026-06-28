import SwiftUI
import WidgetKit

struct TodoWidgetView: View {
  let entry: TodoWidgetEntry

  @Environment(\.colorScheme) var colorScheme
  @Environment(\.widgetFamily) var family

  // MARK: - Adaptive Colors (matches HomeScreenWidgetView / GoalWidgetView)

  private var widgetBg: Color {
    colorScheme == .dark ? Color(hex: "#1B1C30") : Color(hex: "#F5E6D3")
  }
  private var primaryText: Color {
    colorScheme == .dark ? .white : Color(hex: "#5D4E37")
  }
  private var secondaryText: Color {
    colorScheme == .dark ? Color(hex: "#CACACA") : Color(hex: "#6B5A42")
  }
  private var checkboxColor: Color {
    colorScheme == .dark ? Color(hex: "#6B6C80") : Color(hex: "#A89A85")
  }

  // MARK: - Layout

  // Max todo rows before truncating. The small family is square and fits fewer
  // lines than the wide medium family.
  private var maxRows: Int {
    family == .systemSmall ? 5 : 7
  }

  private var displayItems: [WidgetTodoItem] {
    Array(entry.items.prefix(maxRows))
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      titleRow
      if displayItems.isEmpty {
        emptyStateView
      } else {
        todoListView
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    // Uniform inset on all sides — paired with .contentMarginsDisabled() on the
    // widget configs so the top margin equals the side margin exactly.
    .padding(14)
    .widgetURL(URL(string: "bittersweet-mobile://journal"))
    .widgetBackground(widgetBg)
  }

  // MARK: - Title + Add Button

  private var titleRow: some View {
    HStack(alignment: .center) {
      Text("TODOs")
        .font(.system(size: 19, weight: .bold))
        .foregroundStyle(primaryText)
      Spacer()
      addButton
    }
  }

  // Opens the app and routes to the new-TODO modal (see OpenNewTodoIntent).
  private var addButton: some View {
    Button(intent: OpenNewTodoIntent()) {
      Image(systemName: "plus")
        .font(.system(size: 17, weight: .bold))
        .foregroundStyle(primaryText)
        .frame(width: 30, height: 30)
        .background(Circle().fill(checkboxColor.opacity(0.2)))
    }
    .buttonStyle(.plain)
  }

  // MARK: - Empty State

  private var emptyStateView: some View {
    VStack(spacing: 6) {
      Image(systemName: "checkmark.circle")
        .font(.system(size: 22))
        .foregroundStyle(secondaryText)
      Text("All clear")
        .font(.system(size: 15, weight: .semibold))
        .foregroundStyle(primaryText)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .center)
  }

  // MARK: - List

  private var todoListView: some View {
    VStack(alignment: .leading, spacing: 7) {
      ForEach(Array(displayItems.enumerated()), id: \.offset) { _, item in
        todoRow(item)
      }
      Spacer(minLength: 0)
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
  }

  private func todoRow(_ item: WidgetTodoItem) -> some View {
    HStack(spacing: 8) {
      // Tappable checkbox — completes the todo (widget shows incomplete only).
      Button(intent: ToggleTodoIntent(id: item.id)) {
        Image(systemName: "square")
          .font(.system(size: 17, weight: .regular))
          .foregroundStyle(checkboxColor)
      }
      .buttonStyle(.plain)

      if !item.tagIcon.isEmpty {
        Text(item.tagIcon)
          .font(.system(size: 12))
      }

      Text(item.name)
        .font(.system(size: 14, weight: .medium))
        .foregroundStyle(primaryText)
        .lineLimit(1)

      Spacer(minLength: 0)
    }
  }
}
