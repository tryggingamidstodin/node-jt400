package nodejt400;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;

import org.json.simple.JSONArray;
import org.json.simple.JSONObject;

public class ResultSetStream
{
	private final Connection c;

	private final PreparedStatement st;

	private final ResultSet rs;

	private final ResultSetMetaData metaData;

	private final int columnCount;

	private final int bufferSize = 100;

	private boolean next;

	public ResultSetStream(Connection c, PreparedStatement st, ResultSet rs) throws Exception
	{
		this.c = c;
		this.st = st;
		this.rs = rs;
		this.metaData = rs.getMetaData();
		this.columnCount = metaData.getColumnCount();
		this.next = rs.next();
	}

	public void close() throws Exception
	{
		next = false;
		rs.close();
		st.close();
		c.close();
	}

	public String getMetaData() throws Exception
	{
		JSONObject metadataJson = new JSONObject();
		JSONArray columns = new JSONArray();
		metadataJson.put("columns", columns);
		for (int i = 1; i <= columnCount; i++)
		{
			JSONObject column = new JSONObject();
			columns.add(column);
			column.put("name", metaData.getColumnName(i));
			column.put("typeName", metaData.getColumnTypeName(i));
			column.put("precision", metaData.getPrecision(i));
			column.put("scale", metaData.getScale(i));
		}
		return metadataJson.toJSONString();
	}

	public String read() throws Exception
	{
		if (next)
		{
			try
			{
				int i = 0;
				JSONArray rows = new JSONArray();
				while (next && i < bufferSize)
				{
					JSONArray row = new JSONArray();
					for (int j = 1; j <= columnCount; j++)
					{
						row.add(JdbcJsonClient.trim(rs.getString(j)));
					}
					rows.add(row);
					next = rs.next();
					i++;
				}
				return rows.toJSONString();
			}
			catch (Exception ex)
			{
				close();
				throw ex;
			}
		}
		close();
		return null;
	}

}
