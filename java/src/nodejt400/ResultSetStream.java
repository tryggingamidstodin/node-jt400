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

	private final int columnCount;

	private final int bufferSize;

	private boolean next;

	private String sep = "[";

	public ResultSetStream(Connection c, PreparedStatement st, ResultSet rs, int bufferSize, boolean loadMetadata) throws Exception
	{
		this.c = c;
		this.st = st;
		this.rs = rs;
		this.bufferSize = bufferSize;
		ResultSetMetaData metaData = rs.getMetaData();
		this.columnCount = metaData.getColumnCount();
		if(loadMetadata)
		{
			sep += getMetaData(metaData) + ",";
		}
		this.next = rs.next();
	}

	public void close() throws Exception
	{
		next = false;
		rs.close();
		st.close();
		c.close();
	}

	private String getMetaData(ResultSetMetaData metaData) throws Exception
	{
		JSONArray columns = new JSONArray();
		for (int i = 1; i <= columnCount; i++)
		{
			JSONObject column = new JSONObject();
			columns.add(column);
			column.put("name", metaData.getColumnName(i));
			column.put("typeName", metaData.getColumnTypeName(i));
			column.put("precision", metaData.getPrecision(i));
			column.put("scale", metaData.getScale(i));
		}
		return columns.toJSONString();
	}

	public String read() throws Exception
	{
		if (next)
		{
			try
			{
				int i = 0;
				StringBuffer sb = new StringBuffer();
				while (next && i < bufferSize)
				{
					JSONArray row = new JSONArray();
					for (int j = 1; j <= columnCount; j++)
					{
						row.add(JdbcJsonClient.trim(rs.getString(j)));
					}
					sb.append(sep);
					sep = ",";
					sb.append(row.toJSONString());
					next = rs.next();
					i++;
				}
				if(!next)
				{
					sb.append("]");
				}
				return sb.toString();
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
