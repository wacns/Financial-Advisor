package expo.modules.financialadvisor

import android.appwidget.AppWidgetProvider
import android.appwidget.AppWidgetManager
import android.content.Context
import android.app.PendingIntent
import android.net.Uri
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject

class FinancialAdvisorWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) = refresh(context, manager, ids)
  companion object {
    fun refresh(context: Context, manager: AppWidgetManager, ids: IntArray) {
      val data = try { JSONObject(context.getSharedPreferences("financial-advisor-widget", 0).getString("data", "{}") ?: "{}") } catch (_: Exception) { JSONObject() }
      val owner = data.optString("owner", "")
      val templates = data.optJSONArray("templates")
      for (widgetId in ids) {
        val views = RemoteViews(context.packageName, R.layout.financial_advisor_widget)
        views.setTextViewText(R.id.fa_title, if (owner.isBlank()) "FinancialAdvisor · sign in" else "FinancialAdvisor · quick entry")
        fun bind(id: Int, kind: String, template: String = "") {
          val intent = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return
          intent.data = Uri.Builder().scheme("com.wacns.financialadvisor").authority("quick").path("/$kind").appendQueryParameter("owner", owner).appendQueryParameter("template", template).build()
          views.setOnClickPendingIntent(id, PendingIntent.getActivity(context, widgetId * 10 + id, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
        }
        bind(R.id.fa_expense, "expense"); bind(R.id.fa_income, "income")
        val fields = intArrayOf(R.id.fa_template_0, R.id.fa_template_1, R.id.fa_template_2, R.id.fa_template_3)
        for (i in fields.indices) {
          val template = templates?.optJSONObject(i)
          views.setViewVisibility(fields[i], if (owner.isNotBlank() && template != null) View.VISIBLE else View.GONE)
          if (template != null) { views.setTextViewText(fields[i], template.optString("name").take(80)); bind(fields[i], "template", template.optString("id")) }
        }
        manager.updateAppWidget(widgetId, views)
      }
    }
  }
}
