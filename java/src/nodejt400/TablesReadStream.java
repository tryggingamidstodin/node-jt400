package nodejt400;

import java.sql.Connection;
import java.sql.ResultSet;

import org.json.simple.JSONArray;
import org.json.simple.JSONObject;

public class TablesReadStream
{
	private final Connection c;

	private final ResultSet rs;

	private boolean next;

	private final int bufferSize = 100;

	public TablesReadStream(Connection c, String catalog, String schema, String tableNamePattern) throws Exception
	{
		this.c = c;
		this.rs = c.getMetaData().getTables(catalog, schema, tableNamePattern, null);
		this.next = rs.next();
	}

	public String read() throws Exception
	{
		if (next)
		{
			try
			{
				JSONArray rows = new JSONArray();
				int i = 0;
				while (next && i < bufferSize)
				{
					JSONObject table = new JSONObject();
					String tableName = rs.getString(3);
					table.put("table", tableName);
					table.put("remarks", rs.getString(5) == null ? "" : rs.getString(5));
					table.put("schema", rs.getString(2));
					rows.add(table);
					next = rs.next();
					i++;
				}

				return rows.toJSONString();
			}
			catch (Exception ex)
			{
				c.close();
				throw ex;
			}
		}
		c.close();
		return null;
	}

	public String getMetaData() throws Exception
	{
		return null;
	}

	public void close() throws Exception
	{
		rs.close();
		c.close();
	}

}
